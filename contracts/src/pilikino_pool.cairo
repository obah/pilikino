use starknet::{ClassHash, ContractAddress};
use openzeppelin_access::ownable::OwnableComponent;
use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use crate::pilikino_proxy::{IPilikinoProxyDispatcher, IPilikinoProxyDispatcherTrait};

use crate::verifier::honk_verifier::{
    IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait,
};

const ROOT_MAX_SIZE: u32 = 30;
const BN254_FR: u256 = 21888242871839275222246405745257275088548364400416034343698204186575808495617_u256;
const TWO_POW_8: u256 = 256_u256;

#[starknet::interface]
pub trait IPilikinoPool<TContractState> {
    fn deposit(
        ref self: TContractState, token: ContractAddress, amount: u256, commitment: u256,
    ) -> u32;

    fn withdraw(
        ref self: TContractState,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
        nullifier_hash: u256,
        proof: Array<felt252>,
        root_hash: u256,
        calldata_hash: u256,
        new_commitment: u256,
    ) -> u32;
    
    fn execute_action(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        target: ContractAddress,
        selector: felt252,
        action_calldata: Array<felt252>,
        action_id: u256,
        nullifier_hash: u256,
        proof: Array<felt252>,
        root_hash: u256,
        new_commitment: u256,
    ) -> bool;

    fn is_known_root(self: @TContractState, root: u256) -> bool;
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
    fn get_verifier(self: @TContractState) -> ContractAddress;
    fn get_proxy_class_hash(self: @TContractState) -> ClassHash;
    fn get_root(self: @TContractState, index: u32) -> u256;
    fn add_supported_token(ref self: TContractState, token: ContractAddress);
    fn update_verifier(ref self: TContractState, new_verifier: ContractAddress);
    fn update_proxy_class_hash(ref self: TContractState, new_proxy_class_hash: ClassHash);
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}

#[starknet::contract]
mod PilikinoPool {
    use core::keccak::keccak_u256s_be_inputs;
    use core::num::traits::Zero;
    use core::result::ResultTrait;
    use core::traits::Into;
    use openzeppelin_access::ownable::OwnableComponent::InternalTrait;
    use garaga::hashes::poseidon_hash_2_bn254;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_caller_address,
        get_contract_address, get_execution_info,
    };

    use super::{
        BN254_FR, IPilikinoPool, IERC20Dispatcher, IERC20DispatcherTrait,
        IPilikinoProxyDispatcher, IPilikinoProxyDispatcherTrait,
        IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait,
        ROOT_MAX_SIZE, TWO_POW_8, OwnableComponent,
    };

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        verifier: ContractAddress,
        proxy_class_hash: ClassHash,
        proxy_nonce: felt252,
        merkle_tree_depth: u32,
        next_leaf_index: u32,
        current_root_index: u32,
        roots: Map<u32, u256>,
        cached_subtrees: Map<u32, u256>,
        token_balances: Map<ContractAddress, u256>,
        commitments: Map<u256, bool>,
        nullifier_hashes: Map<u256, bool>,
        supported_tokens: Map<ContractAddress, bool>,
        reentrancy_lock: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposit: Deposit,
        Withdrawal: Withdrawal,
        ActionExecuted: ActionExecuted,
        TokenAdded: TokenAdded,
        VerifierUpdated: VerifierUpdated,
        ProxyClassHashUpdated: ProxyClassHashUpdated,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        token: ContractAddress,
        #[key]
        commitment: u256,
        amount: u256,
        inserted_leaf_index: u32,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawal {
        #[key]
        new_commitment: u256,
        #[key]
        recipient: ContractAddress,
        #[key]
        token: ContractAddress,
        amount: u256,
        inserted_leaf_index: u32,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ActionExecuted {
        #[key]
        nullifier_hash: u256,
        #[key]
        proxy: ContractAddress,
        #[key]
        target: ContractAddress,
        selector: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenAdded {
        #[key]
        token: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct VerifierUpdated {
        #[key]
        verifier: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ProxyClassHashUpdated {
        #[key]
        class_hash: ClassHash,
        timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        merkle_tree_depth: u32,
        verifier: ContractAddress,
        proxy_class_hash: ClassHash,
        initial_owner: ContractAddress,
    ) {
        assert(merkle_tree_depth > 0 && merkle_tree_depth < 32, 'invalid tree depth');
        assert(!verifier.is_zero(), 'invalid verifier');
        assert_non_zero_class_hash(proxy_class_hash);

        let owner = if initial_owner.is_zero() { get_caller_address() } else { initial_owner };
        assert(!owner.is_zero(), 'invalid owner');

        self.ownable.initializer(owner);
        self.verifier.write(verifier);
        self.proxy_class_hash.write(proxy_class_hash);
        self.proxy_nonce.write(0);
        self.merkle_tree_depth.write(merkle_tree_depth);
        self.reentrancy_lock.write(false);

        let initial_root = zeroes(merkle_tree_depth);
        self.roots.write(0, initial_root);
        self.current_root_index.write(0);
        self.next_leaf_index.write(0);
    }

    #[abi(embed_v0)]
    impl PilikinoPoolImpl of IPilikinoPool<ContractState> {
        fn deposit(
            ref self: ContractState, token: ContractAddress, amount: u256, commitment: u256,
        ) -> u32 {
            enter_non_reentrant(ref self);

            assert(!self.commitments.read(commitment), 'commitment used');
            assert(amount != 0, 'invalid amount');
            assert(self.supported_tokens.read(token), 'token unsupported');
            assert_in_bn254_field(commitment);
            assert_in_bn254_field(amount);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            let pool_address = get_contract_address();
            let caller = get_caller_address();

            let balance_before = token_dispatcher.balance_of(pool_address);
            assert(
                token_dispatcher.transfer_from(caller, pool_address, amount),
                'transfer_from failed',
            );
            let balance_after = token_dispatcher.balance_of(pool_address);
            let received_amount = balance_after - balance_before;
            assert(received_amount == amount, 'unsupported token behavior');

            let available_balance = self.token_balances.read(token);
            self.token_balances.write(token, available_balance + received_amount);

            let inserted_leaf_index = insert_commitment(ref self, commitment);
            self.commitments.write(commitment, true);

            let timestamp = block_timestamp();
            self
                .emit(
                    Deposit {
                        token,
                        commitment,
                        amount: received_amount,
                        inserted_leaf_index,
                        timestamp,
                    },
                );

            exit_non_reentrant(ref self);
            inserted_leaf_index
        }

        fn withdraw(
            ref self: ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
            nullifier_hash: u256,
            proof: Array<felt252>,
            root_hash: u256,
            calldata_hash: u256,
            new_commitment: u256,
        ) -> u32 {
            enter_non_reentrant(ref self);

            assert(self.supported_tokens.read(token), 'token unsupported');
            assert(!recipient.is_zero(), 'invalid recipient');
            assert(!self.commitments.read(new_commitment), 'commitment used');
            assert(!self.nullifier_hashes.read(nullifier_hash), 'nullifier used');
            assert(is_known_root_internal(@self, root_hash), 'invalid root');
            assert_in_bn254_field(root_hash);
            assert_in_bn254_field(nullifier_hash);
            assert_in_bn254_field(calldata_hash);
            assert_in_bn254_field(new_commitment);
            assert_in_bn254_field(amount);

            let available_balance = self.token_balances.read(token);
            assert(available_balance >= amount, 'insufficient balance');

            let recipient_u256 = contract_address_to_u256(recipient);
            verify_public_inputs(
                @self,
                proof.span(),
                root_hash,
                nullifier_hash,
                recipient_u256,
                calldata_hash,
                amount,
                new_commitment,
            );

            self.nullifier_hashes.write(nullifier_hash, true);
            self.token_balances.write(token, available_balance - amount);

            let inserted_leaf_index = insert_commitment(ref self, new_commitment);
            self.commitments.write(new_commitment, true);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            assert(token_dispatcher.transfer(recipient, amount), 'transfer failed');

            let timestamp = block_timestamp();
            self
                .emit(
                    Withdrawal {
                        new_commitment,
                        recipient,
                        token,
                        amount,
                        inserted_leaf_index,
                        timestamp,
                    },
                );

            exit_non_reentrant(ref self);
            inserted_leaf_index
        }

        fn execute_action(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            target: ContractAddress,
            selector: felt252,
            action_calldata: Array<felt252>,
            action_id: u256,
            nullifier_hash: u256,
            proof: Array<felt252>,
            root_hash: u256,
            new_commitment: u256,
        ) -> bool {
            enter_non_reentrant(ref self);

            let this_contract = get_contract_address();
            assert(!target.is_zero() && target != this_contract, 'invalid target');
            assert(self.supported_tokens.read(token), 'token unsupported');
            assert(target != token, 'target is token');
            assert(!self.commitments.read(new_commitment), 'commitment used');
            assert(!self.nullifier_hashes.read(nullifier_hash), 'nullifier used');
            assert(is_known_root_internal(@self, root_hash), 'invalid root');
            assert(!is_forbidden_token_selector(selector), 'forbidden token selector');
            assert_in_bn254_field(root_hash);
            assert_in_bn254_field(nullifier_hash);
            assert_in_bn254_field(new_commitment);
            assert_in_bn254_field(amount);

            let available_balance = self.token_balances.read(token);
            assert(available_balance >= amount, 'insufficient balance');

            let data_hash = compute_action_calldata_hash(action_id, selector, action_calldata.span());
            let target_u256 = contract_address_to_u256(target);

            verify_public_inputs(
                @self,
                proof.span(),
                root_hash,
                nullifier_hash,
                target_u256,
                data_hash,
                amount,
                new_commitment,
            );

            self.nullifier_hashes.write(nullifier_hash, true);
            let proxy = deploy_action_proxy(ref self, action_id);

            if amount > 0 {
                self.token_balances.write(token, available_balance - amount);
                let token_dispatcher = IERC20Dispatcher { contract_address: token };
                assert(token_dispatcher.transfer(proxy, amount), 'transfer failed');
            }

            let proxy_dispatcher = IPilikinoProxyDispatcher { contract_address: proxy };
            proxy_dispatcher.execute(token, amount, target, selector, action_calldata);

            insert_commitment(ref self, new_commitment);
            self.commitments.write(new_commitment, true);

            let timestamp = block_timestamp();
            self.emit(ActionExecuted { nullifier_hash, proxy, target, selector, timestamp });

            exit_non_reentrant(ref self);
            true
        }

        fn is_known_root(self: @ContractState, root: u256) -> bool {
            is_known_root_internal(self, root)
        }

        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        fn get_verifier(self: @ContractState) -> ContractAddress {
            self.verifier.read()
        }

        fn get_proxy_class_hash(self: @ContractState) -> ClassHash {
            self.proxy_class_hash.read()
        }

        fn get_root(self: @ContractState, index: u32) -> u256 {
            self.roots.read(index)
        }

        fn add_supported_token(ref self: ContractState, token: ContractAddress) {
            assert_owner(@self);
            assert(!token.is_zero(), 'token zero');
            assert(!self.supported_tokens.read(token), 'token already supported');

            self.supported_tokens.write(token, true);

            let timestamp = block_timestamp();
            self.emit(TokenAdded { token, timestamp });
        }

        fn update_verifier(ref self: ContractState, new_verifier: ContractAddress) {
            assert_owner(@self);
            assert(!new_verifier.is_zero(), 'invalid verifier');

            self.verifier.write(new_verifier);

            let timestamp = block_timestamp();
            self.emit(VerifierUpdated { verifier: new_verifier, timestamp });
        }

        fn update_proxy_class_hash(ref self: ContractState, new_proxy_class_hash: ClassHash) {
            assert_owner(@self);
            assert_non_zero_class_hash(new_proxy_class_hash);

            self.proxy_class_hash.write(new_proxy_class_hash);

            let timestamp = block_timestamp();
            self
                .emit(ProxyClassHashUpdated { class_hash: new_proxy_class_hash, timestamp });
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            assert(!new_owner.is_zero(), 'new owner zero');
            self.ownable.assert_only_owner();
            self.ownable._transfer_ownership(new_owner);
        }
    }

    fn assert_owner(self: @ContractState) {
        self.ownable.assert_only_owner();
    }

    fn enter_non_reentrant(ref self: ContractState) {
        assert(!self.reentrancy_lock.read(), 'reentrant call');
        self.reentrancy_lock.write(true);
    }

    fn exit_non_reentrant(ref self: ContractState) {
        self.reentrancy_lock.write(false);
    }

    fn assert_non_zero_class_hash(class_hash: ClassHash) {
        let class_hash_felt: felt252 = class_hash.into();
        assert(class_hash_felt != 0, 'invalid proxy class');
    }

    fn deploy_action_proxy(ref self: ContractState, action_id: u256) -> ContractAddress {
        let proxy_class_hash = self.proxy_class_hash.read();
        assert_non_zero_class_hash(proxy_class_hash);

        let salt = self.proxy_nonce.read();
        self.proxy_nonce.write(salt + 1);

        let action_id_low: felt252 = action_id.low.into();
        let action_id_high: felt252 = action_id.high.into();
        let pool = get_contract_address();
        let pool_felt: felt252 = pool.into();

        let constructor_calldata = array![action_id_low, action_id_high, pool_felt];

        let (proxy_address, _) = starknet::syscalls::deploy_syscall(
            proxy_class_hash, salt, constructor_calldata.span(), false,
        )
            .unwrap_syscall();

        proxy_address
    }

    fn verify_public_inputs(
        self: @ContractState,
        proof: Span<felt252>,
        expected_root: u256,
        expected_nullifier: u256,
        expected_recipient_or_target: u256,
        expected_data_hash: u256,
        expected_amount: u256,
        expected_new_commitment: u256,
    ) {
        let verifier = self.verifier.read();
        assert(!verifier.is_zero(), 'invalid verifier');

        let verifier_dispatcher = IUltraKeccakZKHonkVerifierDispatcher { contract_address: verifier };
        let verification_result = verifier_dispatcher.verify_ultra_keccak_zk_honk_proof(proof);
        assert(verification_result.is_ok(), 'invalid proof');

        let public_inputs = verification_result.unwrap();
        assert(public_inputs.len() >= 6, 'missing public inputs');

        assert(*public_inputs.at(0) == expected_root, 'public input root mismatch');
        assert(*public_inputs.at(1) == expected_nullifier, 'public input nullifier mismatch');
        assert(
            *public_inputs.at(2) == expected_recipient_or_target,
            'pub input addr mismatch',
        );
        assert(*public_inputs.at(3) == expected_data_hash, 'public input data hash mismatch');
        assert(*public_inputs.at(4) == expected_amount, 'public input amount mismatch');
        assert(
            *public_inputs.at(5) == expected_new_commitment,
            'pub input commit mismatch',
        );
    }

    fn compute_action_calldata_hash(
        action_id: u256, selector: felt252, action_calldata: Span<felt252>,
    ) -> u256 {
        let mut words = array![action_id, selector.into()];

        let mut calldata_span = action_calldata;
        loop {
            match calldata_span.pop_front() {
                Option::Some(value) => {
                    let value_u256: u256 = (*value).into();
                    words.append(value_u256);
                },
                Option::None => {
                    break;
                },
            }
        }

        let keccak_le = keccak_u256s_be_inputs(words.span());
        let keccak_be = u256_byte_reverse(keccak_le);

        // Keep the same 248-bit truncation convention used in the Solidity pool.
        keccak_be / TWO_POW_8
    }

    fn u256_byte_reverse(word: u256) -> u256 {
        u256 {
            low: core::integer::u128_byte_reverse(word.high),
            high: core::integer::u128_byte_reverse(word.low),
        }
    }

    fn contract_address_to_u256(addr: ContractAddress) -> u256 {
        let addr_felt: felt252 = addr.into();
        addr_felt.into()
    }

    fn block_timestamp() -> u64 {
        get_execution_info().unbox().block_info.block_timestamp
    }

    fn assert_in_bn254_field(value: u256) {
        assert(value < BN254_FR, 'value exceeds bn254 field');
    }

    fn poseidon_hash_2_u256(left: u256, right: u256) -> u256 {
        let hash_u384 = poseidon_hash_2_bn254(left.into(), right.into());
        hash_u384.try_into().unwrap()
    }

    fn insert_commitment(ref self: ContractState, commitment: u256) -> u32 {
        assert_in_bn254_field(commitment);

        let next_leaf_index = self.next_leaf_index.read();
        let depth = self.merkle_tree_depth.read();
        let max_leaves = max_leaves_for_depth(depth);
        let next_leaf_index_u64: u64 = next_leaf_index.into();
        assert(next_leaf_index_u64 < max_leaves, 'tree out of bounds');

        let mut current_leaf_index = next_leaf_index;
        let mut current_hash = commitment;

        let mut i: u32 = 0;
        loop {
            if i == depth {
                break;
            }

            let (left, right) = if current_leaf_index % 2 == 0 {
                self.cached_subtrees.write(i, current_hash);
                (current_hash, zeroes(i))
            } else {
                (self.cached_subtrees.read(i), current_hash)
            };

            current_hash = poseidon_hash_2_u256(left, right);
            current_leaf_index = current_leaf_index / 2;
            i += 1;
        }

        let current_root_index = self.current_root_index.read();
        let new_root_index = (current_root_index + 1) % ROOT_MAX_SIZE;

        self.current_root_index.write(new_root_index);
        self.roots.write(new_root_index, current_hash);
        self.next_leaf_index.write(next_leaf_index + 1);

        next_leaf_index
    }

    fn max_leaves_for_depth(depth: u32) -> u64 {
        let mut leaves: u64 = 1;
        let mut i: u32 = 0;
        loop {
            if i == depth {
                break;
            }
            leaves = leaves * 2;
            i += 1;
        }
        leaves
    }

    fn is_known_root_internal(self: @ContractState, root: u256) -> bool {
        if root == 0 {
            return false;
        }

        let current_index = self.current_root_index.read();
        let mut i = current_index;

        loop {
            if self.roots.read(i) == root {
                return true;
            }

            if i == 0 {
                i = ROOT_MAX_SIZE;
            }

            i -= 1;
            if i == current_index {
                break;
            }
        }

        false
    }

    fn is_forbidden_token_selector(selector: felt252) -> bool {
        selector == selector!("approve")
            || selector == selector!("transfer")
            || selector == selector!("transferFrom")
            || selector == selector!("transfer_from")
            || selector == selector!("increaseAllowance")
            || selector == selector!("increase_allowance")
            || selector == selector!("decreaseAllowance")
            || selector == selector!("decrease_allowance")
            || selector == selector!("permit")
    }

    fn zeroes(depth: u32) -> u256 {
        assert(depth < 32, 'depth out of bounds');
        match depth {
            0 => 0x00000000000000000000000000000000000000000000000070696c696b696e6f_u256,
            1 => 0x25f9f4c79cf609d6dd68a13c2a50dd645389c45e767812f7a86dd430f583914e_u256,
            2 => 0x1879dcd7016ada23c8574c1f9d33485ec7f0c1cc95cf5f3bda63e2bd998070b2_u256,
            3 => 0x2819cf7c0d16a52e5f307fef73f2a3887cec6e9b815649657f21dab2324e314d_u256,
            4 => 0x0d18bf2bde96b6420dd7daa09fb13a4f976f0b30845c4593efc7cd543bd4c60e_u256,
            5 => 0x1747bcd2c6fd58b64e743a0ce9a885cf13034cdce69a7469f7f615c30d3353cf_u256,
            6 => 0x2ee2fb588d8d9f66c2d445296a38a0d04e1cb0449d2c7358afd83e2000fafd4a_u256,
            7 => 0x0286b6d538d5cff83402522b3b534efcf2e443ad7cc8b2824e24c8466fa11587_u256,
            8 => 0x0f7bff0efb377ffe690c4f2327d75b4c1b0e89e86252850920b022a9fbec9d0c_u256,
            9 => 0x1abd8cb3c853e36142222f01b337fbf80ba1a64dcbac4800a1497d60a3f89f64_u256,
            10 => 0x06e0a70a902f12a11e7ae253812838aff595dd2f2d3527c574a1d55a442fc886_u256,
            11 => 0x152e7c719f65f979a25ec5024bf51b361a62d721f0366f6be2f8f6e4833ca0d6_u256,
            12 => 0x119aa5082892feb65cb6cdab8ceb9bbc7e5f31c3cdbd871a35a48d83b9ce5dad_u256,
            13 => 0x1fcfb07ed93502c78698e1fff295ec2b3c9e05a0dd71fa6cb2a27737b2c0af29_u256,
            14 => 0x137942e92321e476fdc013fa8e1ecfccdf24040f2110bfc4df5446e2e1dcfef1_u256,
            15 => 0x107912e3846b522d5611c27ac620f7e42e2e492c89271eac234264cf283e89f6_u256,
            16 => 0x178e48f6169b2f90f322b6140d1b52909221b93118b860a0be74fbdf27f1b2a4_u256,
            17 => 0x1f96442e7d2399b1118478766c105cf27ad868a30c909f4b52acbb86fee53e87_u256,
            18 => 0x0f785324504391daa39e9664229b706b73705fb4a26aae9b881175cc155452c2_u256,
            19 => 0x26db9172e6f009bdb27b7a1971d6d2080fdefa6fb9cd13e8931522e3b7e93441_u256,
            20 => 0x186fe8795e66e06029e0613cd4e7bc05fd56ef2e27310283e81dfc83907e3601_u256,
            21 => 0x273559dfc5c79549eb09186134a3ae9a27a03fce61affe6eeadaf3edee25cc01_u256,
            22 => 0x12e7e11775a365c204fe1628856569f8007218fa0121ba248969ad8bd67bfd88_u256,
            23 => 0x24d06c24c4cb3a83695d1952e87e47d55c826e30afd9ee651483c210300a006d_u256,
            24 => 0x11fe1041bf3dd3f88f07b54b77acceb9752aab90453241546c833286b3f39cae_u256,
            25 => 0x02adf212c2562cf4c7dcf218ed193594f5178d14da9510848baf8268180358d1_u256,
            26 => 0x04ae79a8233693d9352e00fdb1092f78ea75d5c9f26e8677a5f0bd0e0d858cec_u256,
            27 => 0x26f5328a4594c6cc8752c1e0a04df30d3b8dd125bcd014b27bb9375b6bec9b44_u256,
            28 => 0x049006b6c65997f7456bb2da1f329c3d25a0919f5098d9319e034b1f58a0498f_u256,
            29 => 0x0338c683065a8c49613813d1cda1121c4d9f0c1dc447813a2a6927cea6d602f1_u256,
            30 => 0x2ea5d452831f611fbfb232c4879c344752fd495caa50e046a49480b18c7a914d_u256,
            31 => 0x0afb8399a5ea4c868237c5486e82197dfee2c399f7cd611bc198abe72ec2a562_u256,
            _ => 0,
        }
    }
}
