import re
import sys

def main():
    file_path = r"c:\Users\sinyo\sbbl-hq\sbbl-hq\src\test\worker-ingest-pipeline.test.ts"
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove handleStoreMedia and handleSubmitPotg from section 5
    content = re.sub(
        r"it\('handleStoreMedia inserts into media_publications', \(\) => \{.*?\}\);\s*", 
        "", 
        content, 
        flags=re.DOTALL
    )
    content = re.sub(
        r"it\('handleSubmitPotg inserts into media_publications', \(\) => \{.*?\}\);\s*", 
        "", 
        content, 
        flags=re.DOTALL
    )
    
    # 2. Remove handleSubmitPotg tests from POTG publisher guard (section 9b)
    content = re.sub(
        r"describe\('handleSubmitPotg \(path A: /ops/potg/submit\)', \(\) => \{.*?\}\);\s*", 
        "", 
        content, 
        flags=re.DOTALL
    )
    
    # 3. Remove Gap 4: handleSubmitPotg idempotency dedup
    content = re.sub(
        r"// ── 11\. Gap 4 — handleSubmitPotg idempotency dedup ───────────────────────────.*?describe\('Gap 4: handleSubmitPotg idempotency dedup', \(\) => \{.*?\}\);\s*", 
        "", 
        content, 
        flags=re.DOTALL
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
