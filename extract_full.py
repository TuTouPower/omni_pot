import json, re

with open('.reasonix/truncated-results/1780150303947-c41a8f6f-wait_for_job.txt', 'r') as f:
    data = json.load(f)

output = data['latestOutput']

# Extract each test entry with full detail
pattern = r'(\d+\)\s+\[ui\].*?)(?=\d+\)\s+\[ui\]|\Z)'
matches = re.findall(pattern, output, re.DOTALL)

for m in matches:
    test_num = re.match(r'(\d+)', m)
    num = int(test_num.group(1)) if test_num else 0
    if num > 38 or num < 1:
        continue
    
    print(f'===== TEST {num} =====')
    lines = m.split('\n')
    
    # Print test header
    header = lines[0][:250] if lines else ''
    print(f'HEADER: {header}')
    
    # Extract the full error block (lines between "Error:" and "attachment" or next test)
    error_lines = []
    in_error = False
    for line in lines:
        stripped = line.strip()
        if 'Error:' in line:
            in_error = True
        if in_error:
            if stripped.startswith('attachment #') or stripped.startswith('Error Context:'):
                break
            error_lines.append(line)
    
    print('ERROR BLOCK:')
    for l in error_lines[:30]:  # first 30 lines of error
        print(l)
    print()
