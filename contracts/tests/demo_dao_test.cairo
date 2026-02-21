use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_caller_address, test_address,
};
use starknet::ContractAddress;

use contracts::demo::demo_dao::{IDemoDaoDispatcher, IDemoDaoDispatcherTrait};
use contracts::demo::demo_defi::{IDemoDefiDispatcher, IDemoDefiDispatcherTrait};
use contracts::demo::demo_token::{IDemoTokenDispatcher, IDemoTokenDispatcherTrait};

const FAUCET_AMOUNT: u256 = 1000000000000000000000_u256;

#[derive(Drop)]
struct DaoSetup {
    dao: IDemoDaoDispatcher,
    token: IDemoTokenDispatcher,
    owner: ContractAddress,
    voter1: ContractAddress,
    voter2: ContractAddress,
    non_member: ContractAddress,
}

fn deploy_contract(name: ByteArray, constructor_calldata: @Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (contract_address, _) = contract.deploy(constructor_calldata).unwrap();
    contract_address
}

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn setup() -> DaoSetup {
    let owner = addr(111);
    let voter1 = addr(222);
    let voter2 = addr(333);
    let non_member = addr(444);

    let minter = test_address();
    let minter_felt: felt252 = minter.into();

    let token_constructor = array![minter_felt];
    let token_address = deploy_contract("DemoToken", @token_constructor);
    let token = IDemoTokenDispatcher { contract_address: token_address };

    token.mint(owner, 1000000000000000000000_u256);
    token.mint(voter1, 500000000000000000000_u256);
    token.mint(voter2, 300000000000000000000_u256);

    let token_felt: felt252 = token_address.into();
    let mut dao_constructor = array![];
    dao_constructor.append(token_felt);

    let dao_address = deploy_contract("DemoDao", @dao_constructor);
    let dao = IDemoDaoDispatcher { contract_address: dao_address };

    DaoSetup { dao, token, owner, voter1, voter2, non_member }
}

#[test]
fn test_create_proposal() {
    let setup = setup();

    start_cheat_caller_address(setup.dao.contract_address, setup.owner);
    let proposal_id = setup.dao.create_proposal(addr(0x123), 0, 0_u256);
    stop_cheat_caller_address(setup.dao.contract_address);

    assert(proposal_id == 1, 'invalid proposal id');
    assert(setup.dao.get_proposal_count() == 1, 'invalid proposal count');

    let proposal = setup.dao.get_proposal(proposal_id);
    assert(proposal.proposer == setup.owner, 'invalid proposer');
}

#[test]
fn test_vote() {
    let setup = setup();

    start_cheat_caller_address(setup.dao.contract_address, setup.owner);
    let proposal_id = setup.dao.create_proposal(addr(0x123), 0, 0_u256);
    stop_cheat_caller_address(setup.dao.contract_address);

    start_cheat_caller_address(setup.dao.contract_address, setup.voter1);
    setup.dao.vote(proposal_id, 1);
    stop_cheat_caller_address(setup.dao.contract_address);

    start_cheat_caller_address(setup.dao.contract_address, setup.voter2);
    setup.dao.vote(proposal_id, 0);
    stop_cheat_caller_address(setup.dao.contract_address);

    let votes = setup.dao.get_proposal_votes(proposal_id);
    assert(votes.for_votes == 1_u256, 'invalid for votes');
    assert(votes.against_votes == 1_u256, 'invalid against votes');
}

#[test]
#[should_panic(expected: 'not a member')]
fn test_vote_reverts_for_non_member() {
    let setup = setup();

    start_cheat_caller_address(setup.dao.contract_address, setup.owner);
    let proposal_id = setup.dao.create_proposal(addr(0x123), 0, 0_u256);
    stop_cheat_caller_address(setup.dao.contract_address);

    start_cheat_caller_address(setup.dao.contract_address, setup.non_member);
    setup.dao.vote(proposal_id, 1);
}

#[test]
fn test_execute() {
    let setup = setup();

    let demo_token_class = declare("DemoToken").unwrap().contract_class();
    let demo_token_class_hash_felt: felt252 = (*demo_token_class).class_hash.into();

    let demo_defi_address = deploy_contract("DemoDefi", @array![demo_token_class_hash_felt]);
    let demo_defi = IDemoDefiDispatcher { contract_address: demo_defi_address };

    start_cheat_caller_address(setup.dao.contract_address, setup.owner);
    let proposal_id = setup
        .dao
        .create_proposal(demo_defi_address, selector!("faucet"), 0_u256);

    let mut i: u32 = 0;
    loop {
        if i == 11 {
            break;
        }
        setup.dao.vote(proposal_id, 1);
        i += 1;
    }
    stop_cheat_caller_address(setup.dao.contract_address);

    start_cheat_block_timestamp(setup.dao.contract_address, 9_999_999_999);
    setup.dao.execute(proposal_id);

    let proposal = setup.dao.get_proposal(proposal_id);
    assert(proposal.executed, 'proposal not executed');

    let ppusd = IDemoTokenDispatcher { contract_address: demo_defi.ppusd() };
    assert(ppusd.balance_of(setup.dao.contract_address) == FAUCET_AMOUNT, 'faucet not executed');
}

#[test]
fn test_close_proposal() {
    let setup = setup();

    start_cheat_caller_address(setup.dao.contract_address, setup.owner);
    let proposal_id = setup.dao.create_proposal(addr(0x123), 0, 0_u256);

    let mut i: u32 = 0;
    loop {
        if i == 11 {
            break;
        }
        setup.dao.vote(proposal_id, 1);
        i += 1;
    }
    stop_cheat_caller_address(setup.dao.contract_address);

    start_cheat_block_timestamp(setup.dao.contract_address, 9_999_999_999);
    setup.dao.close_proposal(proposal_id);

    assert(setup.dao.has_reached_quorum(proposal_id), 'quorum not reached');
}
