use dep::poseidon::poseidon2::Poseidon2::hash;

pub(crate) fn compute_merkle_root(
    leaf: Field,
    merkle_proof: [Field; 20],
    is_even: [bool; 20],
) -> Field {
    //mutable variable to store hash for the current level we are working on
    let mut current_hash: Field = leaf;

    //iterate through the levels
    for i in 0..20 {
        let (left, right) = if is_even[i] {
            (current_hash, merkle_proof[i])
        } else {
            (merkle_proof[i], current_hash)
        };

        //compute hash for current level
        current_hash = hash([left, right], 2);
    }

    current_hash
}
