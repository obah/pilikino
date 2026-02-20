use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ContractAddress;

use contracts::demo::demo_defi::{IDemoDefiDispatcher, IDemoDefiDispatcherTrait};
use contracts::demo::demo_token::{IDemoTokenDispatcher, IDemoTokenDispatcherTrait};

fn deploy_contract(name: ByteArray, constructor_calldata: @Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (contract_address, _) = contract.deploy(constructor_calldata).unwrap();
    contract_address
}

#[test]
fn test_swap() {
    let demo_token_class = declare("DemoToken").unwrap().contract_class();
    let demo_token_class_hash = (*demo_token_class).class_hash;
    let class_hash_felt: felt252 = demo_token_class_hash.into();

    let demo_defi_address = deploy_contract("DemoDefi", @array![class_hash_felt]);
    let demo_defi = IDemoDefiDispatcher { contract_address: demo_defi_address };

    let token = IDemoTokenDispatcher { contract_address: demo_defi.ppusd() };
    let reward_token = IDemoTokenDispatcher { contract_address: demo_defi.usdtpp() };

    demo_defi.faucet();
    assert(token.balance_of(snforge_std::test_address()) == 1000000000000000000000_u256, 'bad faucet');

    assert(token.approve(demo_defi_address, 100000000000000000000_u256), 'approve failed');
    demo_defi.swap(token.contract_address, 100000000000000000000_u256, reward_token.contract_address);

    assert(token.balance_of(snforge_std::test_address()) == 900000000000000000000_u256, 'bad token bal');
    assert(reward_token.balance_of(snforge_std::test_address()) == 100000000000000000000_u256, 'bad reward bal');
}
