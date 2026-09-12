"""
Test script for SCALE struggle score computation.

Demonstrates that the difficulty-normalized struggle score correctly
identifies struggling learners across different difficulty tiers.
"""
from app.services.scale import (
    compute_struggle_score,
    should_trigger_rewire,
    REWIRE_THRESHOLD,
    DIFFICULTY_MULTIPLIERS,
)


def print_scenario(name: str, score: float, components: dict, should_rewire: bool, reason: str):
    """Pretty-print a test scenario result."""
    print(f"\n{'='*70}")
    print(f"Scenario: {name}")
    print(f"{'='*70}")
    print(f"Struggle Score: {score:.3f} (threshold: {REWIRE_THRESHOLD})")
    print(f"Should trigger REWIRE: {'YES ⚠️' if should_rewire else 'NO ✓'}")
    print(f"Reason: {reason}")
    print(f"\nComponent Breakdown:")
    for component, value in components.items():
        print(f"  {component:15s}: {value:.3f}")
    print(f"{'='*70}")


def main():
    """Run synthetic test scenarios."""
    
    print("\n" + "="*70)
    print("SCALE STRUGGLE SCORE TEST SUITE")
    print("="*70)
    print("\nTesting difficulty-aware normalization...")
    print("Expected outcome: Spending 3x time on FOUNDATIONAL section")
    print("should score HIGHER than 1.2x time on ADVANCED section.\n")
    
    # Scenario 1: Learner spending 3x expected time on a FOUNDATIONAL section
    # This indicates clear struggle on basic material
    print("\n" + "-"*70)
    print("TEST 1: High dwell time on FOUNDATIONAL content")
    print("-"*70)
    print("Setup:")
    print("  - Section difficulty: FOUNDATIONAL (multiplier: 1.0)")
    print("  - Expected baseline: 60 seconds (word count-based)")
    print("  - Actual dwell time: 180 seconds (3x expected)")
    print("  - Other signals: No rereads, no help, quiz correct")
    
    score1, components1, reason1 = compute_struggle_score(
        actual_dwell_seconds=180.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=DIFFICULTY_MULTIPLIERS["foundational"],  # 1.0
        reread_count=0,
        help_requested=False,
        quiz_incorrect=False,
        quiz_response_seconds=None,
    )
    print_scenario(
        "3x time on FOUNDATIONAL section",
        score1,
        components1,
        should_trigger_rewire(score1),
        reason1
    )
    
    # Scenario 2: Learner spending 1.2x expected time on an ADVANCED section
    # This is normal/expected on advanced material
    print("\n" + "-"*70)
    print("TEST 2: Slightly elevated dwell time on ADVANCED content")
    print("-"*70)
    print("Setup:")
    print("  - Section difficulty: ADVANCED (multiplier: 2.5)")
    print("  - Expected baseline: 60 seconds")
    print("  - Expected with difficulty: 150 seconds (60 * 2.5)")
    print("  - Actual dwell time: 180 seconds (1.2x difficulty-adjusted)")
    print("  - Other signals: No rereads, no help, quiz correct")
    
    score2, components2, reason2 = compute_struggle_score(
        actual_dwell_seconds=180.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=DIFFICULTY_MULTIPLIERS["advanced"],  # 2.5
        reread_count=0,
        help_requested=False,
        quiz_incorrect=False,
        quiz_response_seconds=None,
    )
    print_scenario(
        "1.2x time on ADVANCED section",
        score2,
        components2,
        should_trigger_rewire(score2),
        reason2
    )
    
    # Scenario 3: Multiple struggle signals on INTERMEDIATE content
    print("\n" + "-"*70)
    print("TEST 3: Multiple struggle signals on INTERMEDIATE content")
    print("-"*70)
    print("Setup:")
    print("  - Section difficulty: INTERMEDIATE (multiplier: 1.6)")
    print("  - Expected baseline: 60 seconds")
    print("  - Expected with difficulty: 96 seconds")
    print("  - Actual dwell time: 150 seconds (1.56x)")
    print("  - Rereads: 2")
    print("  - Help requested: Yes")
    print("  - Quiz incorrect: Yes")
    print("  - Quiz response time: 45 seconds (vs 30s expected)")
    
    score3, components3, reason3 = compute_struggle_score(
        actual_dwell_seconds=150.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=DIFFICULTY_MULTIPLIERS["intermediate"],  # 1.6
        reread_count=2,
        help_requested=True,
        quiz_incorrect=True,
        quiz_response_seconds=45.0,
        expected_quiz_seconds=30.0,
    )
    print_scenario(
        "Multiple signals on INTERMEDIATE",
        score3,
        components3,
        should_trigger_rewire(score3),
        reason3
    )
    
    # Scenario 4: Normal engagement on INTERMEDIATE content
    print("\n" + "-"*70)
    print("TEST 4: Normal engagement on INTERMEDIATE content (baseline)")
    print("-"*70)
    print("Setup:")
    print("  - Section difficulty: INTERMEDIATE (multiplier: 1.6)")
    print("  - Expected baseline: 60 seconds")
    print("  - Actual dwell time: 80 seconds (0.83x difficulty-adjusted)")
    print("  - Other signals: 1 reread, no help, quiz correct, 25s response")
    
    score4, components4, reason4 = compute_struggle_score(
        actual_dwell_seconds=80.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=DIFFICULTY_MULTIPLIERS["intermediate"],
        reread_count=1,
        help_requested=False,
        quiz_incorrect=False,
        quiz_response_seconds=25.0,
        expected_quiz_seconds=30.0,
    )
    print_scenario(
        "Normal engagement on INTERMEDIATE",
        score4,
        components4,
        should_trigger_rewire(score4),
        reason4
    )
    
    # Summary
    print("\n" + "="*70)
    print("RESULTS SUMMARY")
    print("="*70)
    print(f"\n{'Scenario':<45s} {'Score':>10s} {'REWIRE':>10s}")
    print("-"*70)
    print(f"{'1. 3x time on FOUNDATIONAL':<45s} {score1:>10.3f} {'YES' if should_trigger_rewire(score1) else 'NO':>10s}")
    print(f"{'2. 1.2x time on ADVANCED':<45s} {score2:>10.3f} {'YES' if should_trigger_rewire(score2) else 'NO':>10s}")
    print(f"{'3. Multiple signals on INTERMEDIATE':<45s} {score3:>10.3f} {'YES' if should_trigger_rewire(score3) else 'NO':>10s}")
    print(f"{'4. Normal engagement on INTERMEDIATE':<45s} {score4:>10.3f} {'YES' if should_trigger_rewire(score4) else 'NO':>10s}")
    
    print("\n" + "="*70)
    print("VALIDATION CHECKS")
    print("="*70)
    
    # Check 1: FOUNDATIONAL 3x > ADVANCED 1.2x
    check1_pass = score1 > score2
    print(f"\n✓ CHECK 1: Foundational 3x ({score1:.3f}) > Advanced 1.2x ({score2:.3f})")
    print(f"  Result: {'PASS ✓' if check1_pass else 'FAIL ✗'}")
    
    # Check 2: Multiple signals trigger REWIRE
    check2_pass = should_trigger_rewire(score3)
    print(f"\n✓ CHECK 2: Multiple struggle signals trigger REWIRE")
    print(f"  Score: {score3:.3f}, Threshold: {REWIRE_THRESHOLD}")
    print(f"  Result: {'PASS ✓' if check2_pass else 'FAIL ✗'}")
    
    # Check 3: Normal engagement does NOT trigger REWIRE
    check3_pass = not should_trigger_rewire(score4)
    print(f"\n✓ CHECK 3: Normal engagement does NOT trigger REWIRE")
    print(f"  Score: {score4:.3f}, Threshold: {REWIRE_THRESHOLD}")
    print(f"  Result: {'PASS ✓' if check3_pass else 'FAIL ✗'}")
    
    # Check 4: FOUNDATIONAL 3x triggers REWIRE
    check4_pass = should_trigger_rewire(score1)
    print(f"\n✓ CHECK 4: 3x time on FOUNDATIONAL triggers REWIRE")
    print(f"  Score: {score1:.3f}, Threshold: {REWIRE_THRESHOLD}")
    print(f"  Result: {'PASS ✓' if check4_pass else 'FAIL ✗'}")
    
    all_pass = check1_pass and check2_pass and check3_pass and check4_pass
    
    print("\n" + "="*70)
    if all_pass:
        print("ALL CHECKS PASSED ✓")
        print("\nThe difficulty-normalized struggle score is working correctly!")
    else:
        print("SOME CHECKS FAILED ✗")
        print("\nReview the weights and thresholds in scale.py")
    print("="*70 + "\n")
    
    return 0 if all_pass else 1


if __name__ == "__main__":
    exit(main())
