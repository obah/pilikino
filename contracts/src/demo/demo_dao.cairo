use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub enum ProposalStatus {
    #[default]
    Active,
    Passed,
    Failed,
    Executed,
    Closed,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ProposalCore {
    pub proposer: ContractAddress,
    pub target: ContractAddress,
    pub call_selector: felt252,
    pub value: u256,
    pub start_time: u64,
    pub end_time: u64,
    pub status: ProposalStatus,
    pub executed: bool,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ProposalVotes {
    pub for_votes: u256,
    pub against_votes: u256,
    pub abstain_votes: u256,
}

#[starknet::interface]
pub trait IDemoDao<TContractState> {
    fn create_proposal(
        ref self: TContractState,
        target: ContractAddress,
        call_selector: felt252,
        value: u256,
    ) -> u64;
    fn vote(ref self: TContractState, proposal_id: u64, support: u8);
    fn execute(ref self: TContractState, proposal_id: u64);
    fn close_proposal(ref self: TContractState, proposal_id: u64);

    fn get_proposal_count(self: @TContractState) -> u64;
    fn has_voted(self: @TContractState, proposal_id: u64, voter: ContractAddress) -> bool;
    fn has_reached_quorum(self: @TContractState, proposal_id: u64) -> bool;
    fn is_member(self: @TContractState, account: ContractAddress) -> bool;
    fn get_proposal(self: @TContractState, proposal_id: u64) -> ProposalCore;
    fn get_proposal_votes(self: @TContractState, proposal_id: u64) -> ProposalVotes;
}

#[starknet::contract]
mod DemoDao {
    use core::num::traits::Zero;
    use core::panic_with_felt252;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_caller_address, get_execution_info,
    };

    use super::{
        IDemoDao, IERC20Dispatcher, IERC20DispatcherTrait, ProposalCore, ProposalStatus,
        ProposalVotes,
    };

    const MIN_TOKENS_TO_PROPOSE: u256 = 1000000000000000000_u256;
    const MIN_TOKENS_TO_VOTE: u256 = 1000000000000000000_u256;
    const VOTING_PERIOD: u64 = 2592000;
    const QUORUM_PERCENTAGE: u256 = 1_u256;

    #[storage]
    struct Storage {
        governance_token: ContractAddress,
        proposal_count: u64,
        proposals: Map<u64, ProposalCore>,
        proposal_votes: Map<u64, ProposalVotes>,
        has_voted: Map<(u64, ContractAddress), bool>,

        reentrancy_lock: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        governance_token: ContractAddress,
    ) {
        assert(!governance_token.is_zero(), 'governance token zero');

        self.governance_token.write(governance_token);
        self.reentrancy_lock.write(false);
    }

    #[abi(embed_v0)]
    impl DemoDaoImpl of IDemoDao<ContractState> {
        fn create_proposal(
            ref self: ContractState,
            target: ContractAddress,
            call_selector: felt252,
            value: u256,
        ) -> u64 {
            let caller = get_caller_address();
            assert(is_member_internal(@self, caller), 'insufficient token balance');

            let proposal_id = self.proposal_count.read() + 1;
            let start_time = block_timestamp();
            let end_time = start_time + VOTING_PERIOD;

            self
                .proposals
                .write(
                    proposal_id,
                    ProposalCore {
                        proposer: caller,
                        target,
                        call_selector,
                        value,
                        start_time,
                        end_time,
                        status: ProposalStatus::Active,
                        executed: false,
                    },
                );
            self.proposal_count.write(proposal_id);
            proposal_id
        }

        fn vote(ref self: ContractState, proposal_id: u64, support: u8) {
            assert(is_member_internal(@self, get_caller_address()), 'not a member');
            assert(proposal_exists(@self, proposal_id), 'proposal missing');

            let mut proposal = self.proposals.read(proposal_id);
            assert(proposal.status == ProposalStatus::Active, 'proposal not active');
            assert(block_timestamp() <= proposal.end_time, 'voting period ended');

            let one_vote = 1_u256;
            let mut votes = self.proposal_votes.read(proposal_id);
            if support == 0 {
                votes.against_votes = votes.against_votes + one_vote;
            } else if support == 1 {
                votes.for_votes = votes.for_votes + one_vote;
            } else {
                votes.abstain_votes = votes.abstain_votes + one_vote;
            }

            self.proposal_votes.write(proposal_id, votes);
            self.has_voted.write((proposal_id, get_caller_address()), true);
        }

        fn execute(ref self: ContractState, proposal_id: u64) {
            enter_non_reentrant(ref self);

            assert(proposal_exists(@self, proposal_id), 'proposal missing');

            let mut proposal = self.proposals.read(proposal_id);
            assert(!proposal.executed, 'proposal already executed');
            assert(block_timestamp() > proposal.end_time, 'proposal still active');

            if proposal.status == ProposalStatus::Active {
                finalize_proposal(ref self, proposal_id);
                proposal = self.proposals.read(proposal_id);
            }

            assert(proposal.status == ProposalStatus::Passed, 'proposal not passed');

            proposal.executed = true;
            proposal.status = ProposalStatus::Executed;
            self.proposals.write(proposal_id, proposal);

            let empty_calldata: Array<felt252> = array![];
            match starknet::syscalls::call_contract_syscall(
                proposal.target, proposal.call_selector, empty_calldata.span(),
            ) {
                Result::Ok(_) => {},
                Result::Err(_) => {
                    panic_with_felt252('execution failed');
                },
            };

            exit_non_reentrant(ref self);
        }

        fn close_proposal(ref self: ContractState, proposal_id: u64) {
            assert(proposal_exists(@self, proposal_id), 'proposal missing');

            let proposal = self.proposals.read(proposal_id);
            assert(proposal.status == ProposalStatus::Active, 'proposal not active');
            assert(block_timestamp() > proposal.end_time, 'proposal still active');

            finalize_proposal(ref self, proposal_id);
        }

        fn get_proposal_count(self: @ContractState) -> u64 {
            self.proposal_count.read()
        }

        fn has_voted(self: @ContractState, proposal_id: u64, voter: ContractAddress) -> bool {
            self.has_voted.read((proposal_id, voter))
        }

        fn has_reached_quorum(self: @ContractState, proposal_id: u64) -> bool {
            has_reached_quorum_internal(self, proposal_id)
        }

        fn is_member(self: @ContractState, account: ContractAddress) -> bool {
            is_member_internal(self, account)
        }

        fn get_proposal(self: @ContractState, proposal_id: u64) -> ProposalCore {
            self.proposals.read(proposal_id)
        }

        fn get_proposal_votes(self: @ContractState, proposal_id: u64) -> ProposalVotes {
            self.proposal_votes.read(proposal_id)
        }
    }

    fn proposal_exists(self: @ContractState, proposal_id: u64) -> bool {
        proposal_id > 0 && proposal_id <= self.proposal_count.read()
    }

    fn is_member_internal(self: @ContractState, account: ContractAddress) -> bool {
        let governance_token = IERC20Dispatcher { contract_address: self.governance_token.read() };
        governance_token.balance_of(account) >= MIN_TOKENS_TO_VOTE
    }

    fn has_reached_quorum_internal(self: @ContractState, proposal_id: u64) -> bool {
        let votes = self.proposal_votes.read(proposal_id);
        let total_votes = votes.for_votes + votes.against_votes + votes.abstain_votes;

        total_votes >= (QUORUM_PERCENTAGE * 10_u256)
    }

    fn finalize_proposal(ref self: ContractState, proposal_id: u64) {
        let mut proposal = self.proposals.read(proposal_id);
        let votes = self.proposal_votes.read(proposal_id);

        let quorum_reached = has_reached_quorum_internal(@self, proposal_id);
        let passed = quorum_reached && votes.for_votes > votes.against_votes;

        if passed {
            proposal.status = ProposalStatus::Passed;
        } else {
            proposal.status = ProposalStatus::Failed;
        }

        self.proposals.write(proposal_id, proposal);
    }

    fn block_timestamp() -> u64 {
        get_execution_info().unbox().block_info.block_timestamp
    }

    fn enter_non_reentrant(ref self: ContractState) {
        assert(!self.reentrancy_lock.read(), 'reentrant call');
        self.reentrancy_lock.write(true);
    }

    fn exit_non_reentrant(ref self: ContractState) {
        self.reentrancy_lock.write(false);
    }
}
