import json

with open('.reasonix/truncated-results/1780150303947-c41a8f6f-wait_for_job.txt', 'r') as f:
    data = json.load(f)

output = data['latestOutput']

# Find summary section - look for "Tests:" pattern at the end
tests_idx = output.find('\nTests:')
if tests_idx >= 0:
    print('=== PLAYWRIGHT SUMMARY ===')
    print(output[tests_idx:tests_idx+2000])
else:
    # Try different patterns
    for pat in ['Tests:', '1 flaky', 'passed', 'failed', 'flaky']:
        idx = output.find(pat)
        if idx >= 0:
            print(f'Found "{pat}" at position {idx}')
            print(output[max(0,idx-200):idx+200])
            print()

# Also look for the "older output dropped" and see what was before test 10
# Look for tests 1-9
for i in range(1, 10):
    pat = f'{i}) [ui]'
    idx = output.find(pat)
    if idx >= 0:
        print(f'=== TEST {i} found at pos {idx} ===')
        print(output[idx:idx+300])
        print()
