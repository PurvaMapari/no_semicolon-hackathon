"""
Demo script for SCALE difficulty tagging.

Demonstrates how the system tags sections with difficulty tiers
and uses those tags to normalize struggle detection.
"""
from app.services.scale import tag_section_difficulty, compute_struggle_score


# Sample lesson with varying difficulty levels
SAMPLE_LESSON = """
Introduction to Photosynthesis

Photosynthesis is the process by which plants make their own food using sunlight. Plants are called producers because they produce their own energy. This happens in the leaves of the plant.

The Process of Photosynthesis

Plants need three things for photosynthesis: sunlight, water, and carbon dioxide. The sunlight is absorbed by chlorophyll, the green pigment in leaves. Water comes from the soil through the plant's roots. Carbon dioxide enters through tiny holes in the leaves called stomata.

Light and Dark Reactions

Photosynthesis occurs in two stages. The light-dependent reactions occur in the thylakoid membranes and convert light energy into chemical energy stored in ATP and NADPH. The light-independent reactions (Calvin cycle) occur in the stroma and use ATP and NADPH to fix carbon dioxide into glucose through a complex series of enzymatic reactions involving RuBisCO, the most abundant protein on Earth.

Products and Efficiency

The final products of photosynthesis are glucose (a sugar) and oxygen. Plants use the glucose for energy and growth. The oxygen is released into the air, which we breathe. Plants are essential for life on Earth because they produce the oxygen we need to survive.
"""


def main():
    """Run the difficulty tagging demo."""
    
    print("\n" + "="*70)
    print("SCALE DIFFICULTY TAGGING DEMO")
    print("="*70)
    
    print("\nSAMPLE LESSON:")
    print("-"*70)
    print(SAMPLE_LESSON.strip()[:500] + "...")
    
    print("\n\nTAGGING SECTIONS WITH DIFFICULTY...")
    print("-"*70)
    
    sections = tag_section_difficulty(SAMPLE_LESSON)
    
    print(f"\nFound {len(sections)} sections:\n")
    
    for i, section in enumerate(sections, 1):
        print(f"\n{'='*70}")
        print(f"SECTION {i}")
        print(f"{'='*70}")
        print(f"Text preview: {section['text'][:150]}...")
        print(f"\nDifficulty tier: {section['difficulty_tier'].upper()}")
        print(f"Time multiplier: {section['expected_time_multiplier']}x")
        print(f"Word count: {section['word_count']}")
        print(f"Expected baseline: {section['expected_baseline_seconds']:.1f} seconds")
        print(f"Expected total (with difficulty): {section['expected_baseline_seconds'] * section['expected_time_multiplier']:.1f} seconds")
        print(f"\nRationale: {section['rationale']}")
    
    # Demonstrate struggle score calculation for each section
    print("\n\n" + "="*70)
    print("STRUGGLE SCORE EXAMPLES")
    print("="*70)
    print("\nSimulating a learner who spends 2x expected time on each section...")
    print("(All other signals neutral: no rereads, no help, quiz correct)\n")
    
    for i, section in enumerate(sections, 1):
        expected_total = section['expected_baseline_seconds'] * section['expected_time_multiplier']
        actual_dwell = expected_total * 2.0  # Learner takes 2x expected time
        
        score, components, reason = compute_struggle_score(
            actual_dwell_seconds=actual_dwell,
            expected_baseline_seconds=section['expected_baseline_seconds'],
            expected_time_multiplier=section['expected_time_multiplier'],
            reread_count=0,
            help_requested=False,
            quiz_incorrect=False,
        )
        
        print(f"\nSection {i} ({section['difficulty_tier'].upper()}):")
        print(f"  Expected time: {expected_total:.1f}s")
        print(f"  Actual time: {actual_dwell:.1f}s (2x)")
        print(f"  Struggle score: {score:.3f}")
        print(f"  Triggers REWIRE: {'YES (!)' if score >= 0.6 else 'NO'}")
        print(f"  Reason: {reason}")
    
    print("\n" + "="*70)
    print("KEY INSIGHT")
    print("="*70)
    print("\nThe SAME absolute dwell time (2x expected) produces DIFFERENT")
    print("struggle scores depending on section difficulty.")
    print("\nThis allows PRISM to correctly identify when a learner is")
    print("struggling with FOUNDATIONAL concepts (high concern) vs.")
    print("spending extra time on ADVANCED material (expected behavior).")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
