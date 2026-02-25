use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address, test_address,
};
use snforge_std::fs::{FileTrait, read_txt};
use starknet::ContractAddress;

use contracts::demo::demo_token::{IDemoTokenDispatcher, IDemoTokenDispatcherTrait};
use contracts::pilikino_pool::{IPilikinoPoolDispatcher, IPilikinoPoolDispatcherTrait};

#[derive(Drop)]
struct PoolSetup {
    pool: IPilikinoPoolDispatcher,
    token: IDemoTokenDispatcher,
    owner: ContractAddress,
}

fn deploy_contract(name: ByteArray, constructor_calldata: @Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (contract_address, _) = contract.deploy(constructor_calldata).unwrap();
    contract_address
}

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn felt_to_u256(value: felt252) -> u256 {
    value.into()
}

fn limbs_to_u256(low_limb: felt252, high_limb: felt252) -> u256 {
    let low: u128 = low_limb.try_into().unwrap();
    let high: u128 = high_limb.try_into().unwrap();
    u256 { low, high }
}

fn setup_pool() -> PoolSetup {
    let owner = addr(999);

    let verifier_address = deploy_contract("UltraKeccakZKHonkVerifier", @array![]);
    let proxy_class = declare("PilikinoProxy").unwrap().contract_class();

    let verifier_felt: felt252 = verifier_address.into();
    let proxy_class_hash_felt: felt252 = (*proxy_class).class_hash.into();
    let owner_felt: felt252 = owner.into();
    let pool_constructor = array![20, verifier_felt, proxy_class_hash_felt, owner_felt];
    let pool_address = deploy_contract("PilikinoPool", @pool_constructor);
    let pool = IPilikinoPoolDispatcher { contract_address: pool_address };

    let minter_felt: felt252 = test_address().into();
    let token_address = deploy_contract("DemoToken", @array![minter_felt]);
    let token = IDemoTokenDispatcher { contract_address: token_address };

    start_cheat_caller_address(pool_address, owner);
    pool.add_supported_token(token_address);
    stop_cheat_caller_address(pool_address);

    token.mint(test_address(), 1000000000000000000000_u256);
    assert(token.approve(pool_address, 1000000000000000000000_u256), 'approve failed');

    PoolSetup { pool, token, owner }
}

fn load_withdraw_fixture() -> (u256, u256, u256, u256, u256, u256, ContractAddress, Array<felt252>) {
    let inputs = read_txt(@FileTrait::new("scripts/fixtures/withdraw_inputs.txt"));
    assert(inputs.len() >= 13, 'withdraw fixture missing values');

    let commitment = limbs_to_u256(*inputs.at(0), *inputs.at(1));
    let root_hash = limbs_to_u256(*inputs.at(2), *inputs.at(3));
    let nullifier_hash = limbs_to_u256(*inputs.at(4), *inputs.at(5));
    let calldata_hash = limbs_to_u256(*inputs.at(6), *inputs.at(7));
    let new_commitment = limbs_to_u256(*inputs.at(8), *inputs.at(9));
    let amount_to_withdraw = limbs_to_u256(*inputs.at(10), *inputs.at(11));
    let recipient: ContractAddress = (*inputs.at(12)).try_into().unwrap();

    let proof_calldata = read_txt(@FileTrait::new("scripts/fixtures/proof_calldata.txt"));
    assert(proof_calldata.len() > 0, 'proof calldata fixture empty');

    (
        commitment,
        root_hash,
        nullifier_hash,
        calldata_hash,
        new_commitment,
        amount_to_withdraw,
        recipient,
        proof_calldata,
    )
}

#[test]
fn test_deposit() {
    let setup = setup_pool();

    let amount = 100_u256;
    let commitment = 123456_u256;
    setup.pool.deposit(setup.token.contract_address, amount, commitment);

    assert(setup.token.balance_of(setup.pool.contract_address) == amount, 'pool token balance bad');
}

#[test]
fn test_withdraw_with_real_verifier_and_script_fixture() {
    let setup = setup_pool();

    let (
        commitment,
        root_hash,
        nullifier_hash,
        calldata_hash,
        new_commitment,
        amount_to_withdraw,
        recipient,
        proof_calldata,
    ) = load_withdraw_fixture();

    setup.pool.deposit(setup.token.contract_address, amount_to_withdraw, commitment);

    assert_eq!(setup.pool.get_root(1), root_hash);

    setup
        .pool
        .withdraw(
            setup.token.contract_address,
            recipient,
            amount_to_withdraw,
            nullifier_hash,
            proof_calldata,
            root_hash,
            calldata_hash,
            new_commitment,
        );

    assert(setup.token.balance_of(recipient) == amount_to_withdraw, 'recipient did not receive funds');
}
