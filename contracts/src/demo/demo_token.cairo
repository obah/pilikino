use starknet::ContractAddress;

#[starknet::interface]
pub trait IDemoToken<TContractState> {
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn mint(ref self: TContractState, account: ContractAddress, amount: u256);
}

#[starknet::contract]
mod DemoToken {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    use super::IDemoToken;

    #[storage]
    struct Storage {
        minter: ContractAddress,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, minter: ContractAddress) {
        assert(!minter.is_zero(), 'invalid minter');
        self.minter.write(minter);
    }

    #[abi(embed_v0)]
    impl DemoTokenImpl of IDemoToken<ContractState> {
        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            transfer_tokens(ref self, sender, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool {
            let spender = get_caller_address();
            let current_allowance = self.allowances.read((sender, spender));
            assert(current_allowance >= amount, 'insufficient allowance');
            self.allowances.write((sender, spender), current_allowance - amount);

            transfer_tokens(ref self, sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            self.allowances.write((owner, spender), amount);
            true
        }

        fn mint(ref self: ContractState, account: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            assert(caller == self.minter.read(), 'unauthorized');
            assert(!account.is_zero(), 'invalid recipient');

            let current_balance = self.balances.read(account);
            self.balances.write(account, current_balance + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }
    }

    fn transfer_tokens(
        ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) {
        assert(!recipient.is_zero(), 'invalid recipient');

        let sender_balance = self.balances.read(sender);
        assert(sender_balance >= amount, 'insufficient balance');

        self.balances.write(sender, sender_balance - amount);
        self.balances.write(recipient, self.balances.read(recipient) + amount);
    }
}
