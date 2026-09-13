"""
Test script for SCALE struggle score computation.

Demonstrates that the difficulty-normalized struggle score correctly
identifies struggling learners across different difficulty tiers, enforces
anti-double-counting, and implements the final 100% PRISM SCALE model.
"""
from app.services.scale import (
    compute_struggle_score,
    compute_exceeded_time_contribution,
    should_trigger_rewire,
    REWIRE_THRESHOLD,
    WEIGHT_DWELL_CONTINUOUS,
    WEIGHT_DWELL_EXCEEDED,
    WEIGHT_QUIZ_ACCURACY,
    WEIGHT_HELP,
    WEIGHT_QUIZ_LATENCY,
    WEIGHT_SCROLL,
    DIFFICULTY_EXCEEDED_MAX_CONTRIBUTIONS,
)


def print_scenario(name: str, score: float, components: dict, should_rewire: bool, reason: str):
    """Pretty-print a test scenario result."""
    print(f"\n{'='*70}")
    print(f"Scenario: {name}")
    print(f"{'='*70}")
    print(f"Struggle Score: {score:.3f} (threshold: {REWIRE_THRESHOLD})")
    print(f"Should trigger REWIRE: {'YES [REWIRE]' if should_rewire else 'NO [NORMAL]'}")
    print(f"Reason: {reason}")
    print(f"\nComponent Breakdown:")
    for component, value in components.items():
        print(f"  {component:18s}: {value:.4f}")
    print(f"{'='*70}")


def main():
    """Run synthetic test scenarios."""
    
    print("\n" + "="*70)
    print("SCALE STRUGGLE SCORE TEST SUITE - FINAL MODEL")
    print("="*70)
    
    # ── CHECK 1: Weights sum exactly to 1.00 ─────────────────────────────────
    total_weights = (
        WEIGHT_DWELL_CONTINUOUS +
        WEIGHT_DWELL_EXCEEDED +
        WEIGHT_QUIZ_ACCURACY +
        WEIGHT_HELP +
        WEIGHT_QUIZ_LATENCY +
        WEIGHT_SCROLL
    )
    print(f"\n1. Weight Sum Check: {total_weights:.4f}")
    assert round(total_weights, 4) == 1.00, f"Weights must sum to 1.00, got {total_weights}"
    print("   [OK] Weights sum exactly to 1.00 (Dwell: 30%, Quiz: 35%, Help: 15%, Latency: 10%, Scroll: 10%)")
    
    # ── CHECK 2: Easy, Intermediate, Advanced Maximum Exceeded Contributions ──
    print("\n2. Difficulty-Aware Exceeded-Time Caps Check (at ratio 2.0x):")
    easy_max = compute_exceeded_time_contribution(2.0, "foundational")
    inter_max = compute_exceeded_time_contribution(2.0, "intermediate")
    adv_max = compute_exceeded_time_contribution(2.0, "advanced")
    print(f"   - Foundational (Easy) Max:   {easy_max:.3f} (expected: 0.100)")
    print(f"   - Intermediate (Medium) Max: {inter_max:.3f} (expected: 0.070)")
    print(f"   - Advanced (Hard) Max:       {adv_max:.3f} (expected: 0.050)")
    assert easy_max == 0.10, f"Expected 0.10, got {easy_max}"
    assert inter_max == 0.07, f"Expected 0.07, got {inter_max}"
    assert adv_max == 0.05, f"Expected 0.05, got {adv_max}"
    print("   [OK] Maximum exceeded-time contributions match difficulty tiers (0.10, 0.07, 0.05)")

    # ── CHECK 3: Same relative overrun produces smaller penalty for Advanced than Easy ─
    print("\n3. Relative Overrun Comparison (1.35x dwell on expected time):")
    score_easy, comp_easy, _ = compute_struggle_score(
        actual_dwell_seconds=135.0,
        expected_baseline_seconds=100.0,
        expected_time_multiplier=1.0,
        difficulty_tier="foundational",
    )
    score_adv, comp_adv, _ = compute_struggle_score(
        actual_dwell_seconds=135.0,
        expected_baseline_seconds=100.0,
        expected_time_multiplier=1.0,
        difficulty_tier="advanced",
    )
    print(f"   - Easy (1.35x dwell) struggle score:     {score_easy:.4f} (exceeded: {comp_easy['dwell_exceeded']:.4f})")
    print(f"   - Advanced (1.35x dwell) struggle score: {score_adv:.4f} (exceeded: {comp_adv['dwell_exceeded']:.4f})")
    assert score_easy > score_adv, f"Easy struggle score ({score_easy}) should be higher than Advanced ({score_adv})"
    assert comp_easy['dwell_exceeded'] > comp_adv['dwell_exceeded'], "Easy exceeded component should be higher"
    print("   [OK] Same relative overrun produces lower struggle penalty on Advanced than Easy")

    # ── CHECK 4: Progressive Exceeded-Time Curve ─────────────────────────────
    print("\n4. Progressive Exceeded-Time Curve Check (Easy):")
    p0 = compute_exceeded_time_contribution(0.90, "foundational")
    p1 = compute_exceeded_time_contribution(1.10, "foundational")
    p2 = compute_exceeded_time_contribution(1.35, "foundational")
    p3 = compute_exceeded_time_contribution(1.60, "foundational")
    print(f"   - ratio 0.90 (<= 1.0): {p0:.4f} (expected: 0.000)")
    print(f"   - ratio 1.10 (small):  {p1:.4f} (expected > 0 and <= 0.03)")
    print(f"   - ratio 1.35 (mod):    {p2:.4f} (expected > 0.03 and < 0.10)")
    print(f"   - ratio 1.60 (max):    {p3:.4f} (expected: 0.100)")
    assert p0 == 0.0
    assert 0.0 < p1 <= 0.03
    assert 0.03 < p2 < 0.10
    assert p3 == 0.10
    print("   [OK] Progressive curve behaves correctly across all ratio thresholds")

    # ── CHECK 5: Full Scenarios ──────────────────────────────────────────────
    print("\n5. Running Realistic Scenarios:")

    # Scenario 1: Heavy struggle on Foundational section
    score1, comp1, reason1 = compute_struggle_score(
        actual_dwell_seconds=180.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=1.0,
        difficulty_tier="foundational",
        help_requests_count=2,
        quiz_accuracy=0.20,
    )
    print_scenario("Heavy struggle on Foundational", score1, comp1, should_trigger_rewire(score1), reason1)
    assert should_trigger_rewire(score1), f"Expected REWIRE on heavy struggle, got {score1}"

    # Scenario 2: Normal engagement on Intermediate section
    score2, comp2, reason2 = compute_struggle_score(
        actual_dwell_seconds=60.0,
        expected_baseline_seconds=60.0,
        expected_time_multiplier=1.0,
        difficulty_tier="intermediate",
        quiz_accuracy=1.0,
    )
    print_scenario("Normal engagement on Intermediate", score2, comp2, should_trigger_rewire(score2), reason2)
    assert not should_trigger_rewire(score2), f"Normal engagement should not trigger REWIRE, got {score2}"
    assert score2 == 0.0, f"Expected 0.0 for clean reading on baseline, got {score2}"

    # Scenario 3: Audio replays do not contribute to score
    score3a, _, _ = compute_struggle_score(
        actual_dwell_seconds=60.0,
        expected_baseline_seconds=60.0,
        reread_count=0,
    )
    score3b, _, _ = compute_struggle_score(
        actual_dwell_seconds=60.0,
        expected_baseline_seconds=60.0,
        reread_count=5, # 5 audio replays
    )
    print(f"\n   - Score with 0 audio replays: {score3a:.4f}")
    print(f"   - Score with 5 audio replays: {score3b:.4f}")
    assert score3a == score3b, "Audio replays must NOT contribute to struggle score"
    print("   [OK] Audio replays produce zero score contribution")

    print("\n" + "="*70)
    print("ALL BACKEND SCALE STRUGGLE SCORE TESTS PASSED [OK]")
    print("="*70 + "\n")
    return 0


if __name__ == "__main__":
    exit(main())
