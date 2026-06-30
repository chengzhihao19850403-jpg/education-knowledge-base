// Backward-compatible entry. The old script expanded every lesson to 50
// questions and caused repeated tests. Keep this path but rebuild with the
// refined all-multiple-choice lesson tests.
await import('./rebuild_clean_training_tests.mjs');
