use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use starknet::ContractAddress;

#[starknet::interface]
pub trait IPilikinoProxy<TContractState> {
    fn execute(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        target: ContractAddress,
        selector: felt252,
        action_calldata: Array<felt252>,
    );

    fn withdraw(
        ref self: TContractState,
        token: ContractAddress,
        recipient: ContractAddress,
        secret: u256,
    ) -> u256;

    fn get_action_id(self: @TContractState) -> u256;
    fn get_pool(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod PilikinoProxy {
    use core::keccak::keccak_u256s_be_inputs;
    use core::num::traits::Zero;
    use core::traits::Into;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{
        ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address,
        get_execution_info,
    };

    use super::{IERC20Dispatcher, IERC20DispatcherTrait, IPilikinoProxy};

    #[storage]
    struct Storage {
        action_id: u256,
        pool: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ActionExecuted: ActionExecuted,
        FundsWithdrawn: FundsWithdrawn,
    }

    #[derive(Drop, starknet::Event)]
    struct ActionExecuted {
        #[key]
        target: ContractAddress,
        selector: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct FundsWithdrawn {
        #[key]
        token: ContractAddress,
        #[key]
        recipient: ContractAddress,
        amount: u256,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, action_id: u256, pool: ContractAddress) {
        assert(!pool.is_zero(), 'pool zero');
        self.action_id.write(action_id);
        self.pool.write(pool);
    }

    #[abi(embed_v0)]
    impl PilikinoProxyImpl of IPilikinoProxy<ContractState> {
        fn execute(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            target: ContractAddress,
            selector: felt252,
            action_calldata: Array<felt252>,
        ) {
            let caller = get_caller_address();
            assert(caller == self.pool.read(), 'unauthorized');
            assert(!target.is_zero(), 'target zero');

            if amount > 0 {
                assert(!token.is_zero(), 'token zero');
                let token_dispatcher = IERC20Dispatcher { contract_address: token };
                assert(token_dispatcher.approve(target, amount), 'approve failed');
            }

            starknet::syscalls::call_contract_syscall(target, selector, action_calldata.span())
                .unwrap_syscall();

            if amount > 0 {
                let token_dispatcher = IERC20Dispatcher { contract_address: token };
                assert(token_dispatcher.approve(target, 0), 'reset approve failed');
            }

            let timestamp = block_timestamp();
            self.emit(ActionExecuted { target, selector, timestamp });
        }

        fn withdraw(
            ref self: ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            secret: u256,
        ) -> u256 {
            assert(!token.is_zero(), 'token zero');
            assert(!recipient.is_zero(), 'recipient zero');

            let expected_action_id = compute_action_id(secret);
            assert(expected_action_id == self.action_id.read(), 'invalid secret');

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            let this_contract = get_contract_address();
            let balance = token_dispatcher.balance_of(this_contract);

            if balance > 0 {
                assert(token_dispatcher.transfer(recipient, balance), 'transfer failed');
            }

            let timestamp = block_timestamp();
            self.emit(FundsWithdrawn { token, recipient, amount: balance, timestamp });
            balance
        }

        fn get_action_id(self: @ContractState) -> u256 {
            self.action_id.read()
        }

        fn get_pool(self: @ContractState) -> ContractAddress {
            self.pool.read()
        }
    }

    fn compute_action_id(secret: u256) -> u256 {
        let secret_word = array![secret];
        let action_id_le = keccak_u256s_be_inputs(secret_word.span());
        u256_byte_reverse(action_id_le)
    }

    fn u256_byte_reverse(word: u256) -> u256 {
        u256 {
            low: core::integer::u128_byte_reverse(word.high),
            high: core::integer::u128_byte_reverse(word.low),
        }
    }

    fn block_timestamp() -> u64 {
        get_execution_info().unbox().block_info.block_timestamp
    }
}
