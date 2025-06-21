import os

from PIL import Image

# Folder where the script runs
folder = os.getcwd()

# Supported input formats
supported_extensions = [".jpg", ".jpeg", ".png"]

# Loop through files in the current directory
for filename in os.listdir(folder):
    name, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext in supported_extensions:
        image_path = os.path.join(folder, filename)
        output_path = os.path.join(folder, f"{name}.webp")

        try:
            with Image.open(image_path) as img:
                img.save(output_path, "webp")
            os.remove(image_path)
            print(f"✅ Converted and removed: {filename} → {name}.webp")
        except Exception as e:
            print(f"❌ Failed to convert {filename}: {e}")
