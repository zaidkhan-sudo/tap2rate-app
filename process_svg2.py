import re
import xml.etree.ElementTree as ET

with open('frontend/public/logo-symbol.svg', 'r') as f:
    svg_content = f.read()
    
ET.register_namespace('', "http://www.w3.org/2000/svg")
root = ET.fromstring(svg_content)
namespace = {'svg': 'http://www.w3.org/2000/svg'}

min_x, min_y = float('inf'), float('inf')
max_x, max_y = float('-inf'), float('-inf')

for path in root.findall('.//svg:path', namespace):
    d = path.get('d')
    numbers = [float(x) for x in re.findall(r'-?\d+\.?\d*', d)]
    x_coords = numbers[0::2]
    y_coords = numbers[1::2]
    if x_coords:
        min_x = min(min_x, min(x_coords))
        max_x = max(max_x, max(x_coords))
    if y_coords:
        min_y = min(min_y, min(y_coords))
        max_y = max(max_y, max(y_coords))

# Add a small padding
pad = 10
vb_x = max(0, min_x - pad)
vb_y = max(0, min_y - pad)
vb_w = max_x - min_x + 2*pad
vb_h = max_y - min_y + 2*pad

print(f"Computed viewBox: {vb_x} {vb_y} {vb_w} {vb_h}")
root.set('viewBox', f"{vb_x} {vb_y} {vb_w} {vb_h}")

# Write the new SVG
with open('frontend/public/logo-symbol.svg', 'wb') as f:
    f.write(ET.tostring(root))
