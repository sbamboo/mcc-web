function compareMcVer(version1, version2, textPlacement = 'last') {
    const parseVersion = (version) => {
        // Extract text placeholder and base version
        const textMatch = version.match(/^(.*?)([a-zA-Z_]+)?$/);
        const baseVersion = textMatch[1];
        const textPlaceholder = textMatch[2] || '';

        // Extract snapshot information
        const snapshotMatch = baseVersion.match(/(\d{2}w\d{2}[a-z]?)(_text)?$/);
        const snapshot = snapshotMatch ? snapshotMatch[0] : '';
        const baseVersionWithoutSnapshot = baseVersion.replace(snapshot, '');

        // Split base version into parts and parse as integers
        const baseParts = baseVersionWithoutSnapshot.split(/[\.\-_]/).map(part => isNaN(part) ? 0 : parseInt(part, 10));

        // Fill in any missing parts with zeroes
        while (baseParts.length < 5) {
            baseParts.push(0);
        }

        return { baseParts, snapshot, textPlaceholder };
    };

    const { baseParts: baseParts1, snapshot: snapshot1, textPlaceholder: text1 } = parseVersion(version1);
    const { baseParts: baseParts2, snapshot: snapshot2, textPlaceholder: text2 } = parseVersion(version2);

    const compareBaseVersions = () => {
        for (let i = 0; i < baseParts1.length; i++) {
            if (baseParts1[i] > baseParts2[i]) return 1;
            if (baseParts1[i] < baseParts2[i]) return -1;
        }
        return 0;
    };

    const compareSnapshots = () => {
        if (snapshot1 && !snapshot2) return 1; // Snapshot1 is newer
        if (!snapshot1 && snapshot2) return -1; // Snapshot2 is newer
        if (snapshot1 && snapshot2) {
            return snapshot1.localeCompare(snapshot2); // Compare snapshots
        }
        return 0;
    };

    const compareTextPlaceholders = () => {
        if (textPlacement === 'last') {
            // For 'last', versions with text placeholders should come after
            if (text1 && !text2) return 1;
            if (!text1 && text2) return -1;
            if (text1 && text2) return text1.localeCompare(text2);
        } else { // textPlacement === 'first'
            // For 'first', versions with text placeholders should come before
            if (text1 && !text2) return -1;
            if (!text1 && text2) return 1;
            if (text1 && text2) return text1.localeCompare(text2);
        }
        return 0;
    };

    // First, compare base versions
    const baseComparison = compareBaseVersions();
    if (baseComparison !== 0) {
        return baseComparison;
    }

    // Ensure snapshots come after main versions
    if (snapshot1 && !snapshot2) return 1;
    if (!snapshot1 && snapshot2) return -1;

    // Compare snapshots if both versions have them
    if (snapshot1 && snapshot2) {
        const snapshotComparison = compareSnapshots();
        if (snapshotComparison !== 0) return snapshotComparison;
    }

    // Finally, compare text placeholders
    return compareTextPlaceholders();
}



// Example Usage:
const testCases = [
    { ver1: '1.22', ver2: '1.21.1', placement: 'last', expected: 1 },
    { ver1: '1.21', ver2: '1.22', placement: 'last', expected: -1 },
    { ver1: '1.22.1', ver2: '1.22', placement: 'last', expected: 1 },
    { ver1: '1.21.2.0.1', ver2: '1.21.2.0.2', placement: 'last', expected: -1 },
    { ver1: '22w03a', ver2: '22w02b', placement: 'last', expected: 1 },
    { ver1: '22w03a', ver2: '22w03b', placement: 'last', expected: -1 },
    { ver1: '22w01a_text', ver2: '22w01a', placement: 'last', expected: 1 },
    { ver1: '1.21_peach', ver2: '1.21', placement: 'last', expected: -1 },
    { ver1: '1.21', ver2: '1.21_peach', placement: 'first', expected: -1 },
    { ver1: 'test', ver2: '1.21', placement: 'last', expected: -1 },
    { ver1: 'test', ver2: '1.21', placement: 'first', expected: 1 },
    { ver1: '1.21', ver2: 'test', placement: 'last', expected: 1 },
    { ver1: '1.21', ver2: 'test', placement: 'first', expected: -1 },
    { ver1: '22w03a', ver2: '22w03b', placement: 'first', expected: -1 },
    { ver1: '22w03a_text', ver2: '22w03a', placement: 'first', expected: 1 },
    { ver1: '22w03a_text', ver2: '22w03b_text', placement: 'last', expected: -1 },
    { ver1: '1.22.1.2.3.4', ver2: '1.22.1', placement: 'last', expected: 1 },
    { ver1: '1.22.1', ver2: '1.22.1.2.3.4', placement: 'last', expected: -1 },
    { ver1: '1.21.2', ver2: '1.21.2.0.1', placement: 'last', expected: -1 },
    { ver1: '1.21.2.0.1', ver2: '1.21.2', placement: 'last', expected: 1 },
    { ver1: '1.21', ver2: '1.21.1.0', placement: 'last', expected: -1 },
    { ver1: '1.21.1.0', ver2: '1.21', placement: 'last', expected: 1 },
    { ver1: '1.22.0', ver2: '1.22', placement: 'last', expected: 0 },
    { ver1: '1.22', ver2: '1.22.0', placement: 'last', expected: 0 },
    { ver1: '1.22a', ver2: '1.22b', placement: 'last', expected: -1 },
    { ver1: '1.22b', ver2: '1.22a', placement: 'last', expected: 1 },
    { ver1: '22w03a_text', ver2: '22w03a_text', placement: 'first', expected: 0 },
    { ver1: '22w03b_text', ver2: '22w03a_text', placement: 'last', expected: 1 },
    { ver1: '22w03b', ver2: '22w03a', placement: 'last', expected: 1 },
    { ver1: 'test', ver2: '22w03b', placement: 'first', expected: 1 },
    { ver1: '22w03b', ver2: 'test', placement: 'first', expected: -1 },
    { ver1: 'test', ver2: '22w03b', placement: 'last', expected: -1 },
    { ver1: '22w03b', ver2: 'test', placement: 'last', expected: 1 }
];

testCases.forEach(({ ver1, ver2, placement, expected }) => {
    const result = compareMcVer(ver1, ver2, placement);
    const status = result === expected ? '✔️' : '❌';
    console.log(`Comparing "${ver1}" with "${ver2}" using textPlacement "${placement}": ${result} (Expected: ${expected}) ${status}`);
});