import json, re, sys

with open('.reasonix/truncated-results/1780150303947-c41a8f6f-wait_for_job.txt', 'r') as f:
    data = json.load(f)

output = data['latestOutput']

# Print summary section
summary_idx = output.find('Tests:')
if summary_idx >= 0:
    print('=== SUMMARY SECTION ===')
    print(output[summary_idx:])
    print()

# Find all test entries starting with a digit followed by ') [ui]'
# Each test entry ends before the next test entry or at end of string
pattern = r'(\d+\)\s+\[ui\].*?)(?=\d+\)\s+\[ui\]|\Z)'
matches = re.findall(pattern, output, re.DOTALL)

for m in matches:
    test_num = re.match(r'(\d+)', m)
    num = test_num.group(1) if test_num else '?'
    print(f'=== TEST {num} ===')
    lines = m.split('\n')
    title_line = lines[0] if lines else ''
    print(title_line[:200])
    # Find the error message (usually "Error:" or "Error: ...")
    for i, line in enumerate(lines):
        if 'Error:' in line and 'No window matching' not in line and 'expect(' not in line and 'locator.evaluate' not in line:
            # Check if next line has more context
            print(line[:200])
            break
        elif 'Error:' in line:
            print(line[:200])
            for j in range(i+1, min(i+5, len(lines))):
                l = lines[j].strip()
                if l and not l.startswith('at ') and not l.startswith('attachment'):
                    print('  ' + l[:200])
                    break
            break
    print()
