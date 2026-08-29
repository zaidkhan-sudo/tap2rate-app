import re
import xml.etree.ElementTree as ET

# Read the SVG file
with open('frontend/public/vista logos 2/transparent-logo.svg', 'r') as f:
    svg_content = f.read()

# Register namespace
ET.register_namespace('', "http://www.w3.org/2000/svg")

# Parse XML
root = ET.fromstring(svg_content)
namespace = {'svg': 'http://www.w3.org/2000/svg'}

# Find all paths
paths_to_remove = []
for path in root.findall('.//svg:path', namespace):
    d = path.get('d')
    # Find all Y coordinates
    # A simple heuristic: find all numbers following a command (like M, C)
    # The format is often command x y or x y x y x y
    # Actually, we can just find all numbers and see if they are mostly > 700
    # Let's use regex to find all floats
    numbers = [float(x) for x in re.findall(r'-?\d+\.?\d*', d)]
    
    # In M x y, C x1 y1 x2 y2 x3 y3, every second number is a Y coordinate
    y_coords = numbers[1::2]
    if y_coords and all(y > 700 for y in y_coords):
        paths_to_remove.append(path)

# Remove the paths
for path in paths_to_remove:
    # We need to find the parent to remove the child
    for parent in root.iter():
        if path in parent:
            parent.remove(path)
            break

# Also let's crop the viewBox to just the symbol height
# The symbol seems to be between Y=90 and Y=630, X between 200 and 800
root.set('viewBox', '200 90 600 550')

# Write the new SVG
with open('frontend/public/logo-symbol.svg', 'wb') as f:
    f.write(ET.tostring(root))

print(f"Removed {len(paths_to_remove)} paths.")
