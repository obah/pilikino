use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use starknet::ContractAddress;

use crate::demo::demo_token::{IDemoTokenDispatcher, IDemoTokenDispatcherTrait};

const FAUCET_AMOUNT: u256 = 1000000000000000000000_u256;

#[starknet::interface]
pub trait IDemoDefi<TContractState> {
    fn ppusd(self: @TContractState) -> ContractAddress;
    fn usdtpp(self: @TContractState) -> ContractAddress;
    fn faucet(ref self: TContractState);
    fn swap(
        ref self: TContractState,
        token_in: ContractAddress,
        amount_in: u256,
        token_out: ContractAddress,
    );
    fn swap_simple(ref self: TContractState, amount_in: u256);
}

#[starknet::contract]
mod DemoDefi {
    use core::num::traits::Zero;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address,
    };


    use super::{
        FAUCET_AMOUNT, IDemoDefi, IDemoTokenDispatcher, IDemoTokenDispatcherTrait,
        IERC20Dispatcher, IERC20DispatcherTrait,
    };

    #[storage]
    struct Storage {
        ppusd: ContractAddress,
        usdtpp: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, demo_token_class_hash: ClassHash) {
        let this_contract = get_contract_address();
        let this_felt: felt252 = this_contract.into();

        let constructor_calldata = array![this_felt];

        let (ppusd_address, _) = starknet::syscalls::deploy_syscall(
            demo_token_class_hash, 1, constructor_calldata.span(), false,
        )
            .unwrap_syscall();

        let (usdtpp_address, _) = starknet::syscalls::deploy_syscall(
            demo_token_class_hash, 2, constructor_calldata.span(), false,
        )
            .unwrap_syscall();

        self.ppusd.write(ppusd_address);
        self.usdtpp.write(usdtpp_address);
    }

    #[abi(embed_v0)]
    impl DemoDefiImpl of IDemoDefi<ContractState> {
        fn ppusd(self: @ContractState) -> ContractAddress {
            self.ppusd.read()
        }

        fn usdtpp(self: @ContractState) -> ContractAddress {
            self.usdtpp.read()
        }

        fn faucet(ref self: ContractState) {
            let caller = get_caller_address();
            let ppusd_dispatcher = IDemoTokenDispatcher { contract_address: self.ppusd.read() };
            ppusd_dispatcher.mint(caller, FAUCET_AMOUNT);
        }

        fn swap(
            ref self: ContractState,
            token_in: ContractAddress,
            amount_in: u256,
            token_out: ContractAddress,
        ) {
            let ppusd_address = self.ppusd.read();
            let usdtpp_address = self.usdtpp.read();

            assert(token_in == ppusd_address && token_out == usdtpp_address, 'unsupported pair');

            swap_ppusd_to_usdtpp(ppusd_address, usdtpp_address, amount_in);
        }

        fn swap_simple(ref self: ContractState, amount_in: u256) {
            let ppusd_address = self.ppusd.read();
            let usdtpp_address = self.usdtpp.read();
            swap_ppusd_to_usdtpp(ppusd_address, usdtpp_address, amount_in);
        }
    }

    fn swap_ppusd_to_usdtpp(
        ppusd_address: ContractAddress, usdtpp_address: ContractAddress, amount_in: u256,
    ) {
        let caller = get_caller_address();
        let this_contract = get_contract_address();

        assert(!caller.is_zero(), 'invalid caller');

        let token_in_dispatcher = IERC20Dispatcher { contract_address: ppusd_address };
        assert(
            token_in_dispatcher.transfer_from(caller, this_contract, amount_in),
            'transfer_from failed',
        );

        let token_out_dispatcher = IDemoTokenDispatcher { contract_address: usdtpp_address };
        token_out_dispatcher.mint(caller, amount_in);
    }
}
