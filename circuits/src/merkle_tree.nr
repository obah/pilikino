use poseidon::poseidon::bn254::hash_2;

pub(crate) fn compute_merkle_root(
    leaf: Field,
    merkle_proof: [Field; 20],
    is_even: [bool; 20],
) -> Field {
    let mut current_hash: Field = leaf;

    for i in 0..20 {
        let (left, right) = if is_even[i] {
            (current_hash, merkle_proof[i])
        } else {
            (merkle_proof[i], current_hash)
        };

        current_hash = hash_2([left, right]);
    }

    current_hash
}
