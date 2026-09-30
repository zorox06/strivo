import { describe, it, expect } from 'vitest';
import { generateKnockoutDraw, generateSeedOrder, nextPowerOfTwo } from '../src/lib/draws/knockout';

describe('Knockout Bracket Generator', () => {
  it('calculates correct next power of 2', () => {
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });

  it('generates standard tournament seed order for brackets', () => {
    expect(generateSeedOrder(4)).toEqual([1, 4, 3, 2]);
    expect(generateSeedOrder(8)).toEqual([1, 8, 4, 5, 3, 6, 2, 7]);
  });

  it('generates a full 8-player knockout bracket seeded by rating', () => {
    const players = [
      { id: 'p1', name: 'Seed 1', rating: 1200 },
      { id: 'p2', name: 'Seed 2', rating: 1150 },
      { id: 'p3', name: 'Seed 3', rating: 1100 },
      { id: 'p4', name: 'Seed 4', rating: 1050 },
      { id: 'p5', name: 'Seed 5', rating: 1000 },
      { id: 'p6', name: 'Seed 6', rating: 950 },
      { id: 'p7', name: 'Seed 7', rating: 900 },
      { id: 'p8', name: 'Seed 8', rating: 850 },
    ];

    const draw = generateKnockoutDraw(players);

    expect(draw.bracketSize).toBe(8);
    expect(draw.roundsCount).toBe(3); // Quarterfinal, Semifinal, Final
    expect(draw.byesCount).toBe(0);
    expect(draw.rounds.length).toBe(3);

    const round1 = draw.rounds[0].matches;
    expect(round1.length).toBe(4);

    // Slot 1: Seed 1 (p1) vs Seed 8 (p8)
    expect(round1[0].entryA?.id).toBe('p1');
    expect(round1[0].entryB?.id).toBe('p8');

    // Slot 2: Seed 4 (p4) vs Seed 5 (p5)
    expect(round1[1].entryA?.id).toBe('p4');
    expect(round1[1].entryB?.id).toBe('p5');

    // Slot 3: Seed 3 (p3) vs Seed 6 (p6)
    expect(round1[2].entryA?.id).toBe('p3');
    expect(round1[2].entryB?.id).toBe('p6');

    // Slot 4: Seed 2 (p2) vs Seed 7 (p7)
    expect(round1[3].entryA?.id).toBe('p2');
    expect(round1[3].entryB?.id).toBe('p7');
  });

  it('awards byes to top seeds when participant count is not a power of 2', () => {
    // 6 players -> Bracket size = 8, Byes = 2. Seed 1 and Seed 2 should get byes!
    const players = [
      { id: 'p1', name: 'Player 1', rating: 1200 },
      { id: 'p2', name: 'Player 2', rating: 1150 },
      { id: 'p3', name: 'Player 3', rating: 1100 },
      { id: 'p4', name: 'Player 4', rating: 1050 },
      { id: 'p5', name: 'Player 5', rating: 1000 },
      { id: 'p6', name: 'Player 6', rating: 950 },
    ];

    const draw = generateKnockoutDraw(players);

    expect(draw.bracketSize).toBe(8);
    expect(draw.byesCount).toBe(2);

    const round1 = draw.rounds[0].matches;

    // Match 1: Seed 1 vs Seed 8 (Seed 8 is a Bye)
    expect(round1[0].entryA?.id).toBe('p1');
    expect(round1[0].entryB).toBeNull();
    expect(round1[0].isBye).toBe(true);
    expect(round1[0].winner?.id).toBe('p1');

    // Match 4: Seed 2 vs Seed 7 (Seed 7 is a Bye)
    expect(round1[3].entryA?.id).toBe('p2');
    expect(round1[3].entryB).toBeNull();
    expect(round1[3].isBye).toBe(true);
    expect(round1[3].winner?.id).toBe('p2');

    // Matches 2 and 3 are played between real players
    expect(round1[1].isBye).toBe(false);
    expect(round1[2].isBye).toBe(false);

    // In Round 2 (Semifinals), the bye winners (p1 and p2) are already populated!
    const round2 = draw.rounds[1].matches;
    expect(round2[0].entryA?.id).toBe('p1');
    expect(round2[1].entryB?.id).toBe('p2');
  });
});
