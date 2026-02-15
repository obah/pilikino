use dep::poseidon::poseidon2::Poseidon2::hash;

mod merkle_tree;

fn main(
    //public inputs
    root_hash: pub Field,
    nullifier_hash: pub Field,
    recipient_address: pub Field,
    data_hash: pub Field, // 248-bit truncated Keccak256 hash of action context
    amount_to_withdraw: pub Field,
    new_commitment: pub Field,
    //private inputs
    nullifier: Field,
    new_nullifier: Field,
    secret: Field,
    amount_in_pool: Field,
    amount_left: Field,
    merkle_proof: [Field; 20],
    is_even: [bool; 20],
) {
    amount_in_pool.assert_max_bit_size::<120>();
    amount_to_withdraw.assert_max_bit_size::<120>();
    amount_left.assert_max_bit_size::<120>();
    assert(amount_in_pool == amount_to_withdraw + amount_left, "Invalid amounts");

    let commitment: Field = hash([nullifier, secret, amount_in_pool], 3);

    let computed_nullifier_hash: Field = hash([nullifier], 1);
    assert(computed_nullifier_hash == nullifier_hash, "Invalid nullifier hash");

    let action_context_hash: Field = hash([recipient_address, data_hash], 2);

    let computed_merkle_root = merkle_tree::compute_merkle_root(commitment, merkle_proof, is_even);
    assert(computed_merkle_root == root_hash, "Invalid merkle proof");

    let computed_new_commitment: Field =
        hash([new_nullifier, secret, amount_left, action_context_hash], 4);
    assert(computed_new_commitment == new_commitment, "Invalid new commitment");
}
