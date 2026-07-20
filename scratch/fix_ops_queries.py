import re

def main():
    file_path = r"C:\Users\sinyo\sbbl-hq\sbbl-hq\src\pages\Ops.tsx"
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace `enabled: activeTab === '...'` or similar with `enabled: true`
    # Also handle `activeTab === 'overview' || activeTab === 'history'`
    content = re.sub(r"enabled:\s*activeTab\s*===\s*'[^']+'(?:\s*\|\|\s*activeTab\s*===\s*'[^']+')*,", "enabled: true,", content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
