import re

def main():
    file_path = r"C:\Users\sinyo\sbbl-hq\sbbl-hq\src\pages\Ops.tsx"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove Tabs imports
    content = re.sub(r"import \{ Tabs, TabsContent, TabsList, TabsTrigger \} from '@/components/ui/tabs';\n?", "", content)
    
    # 2. Remove activeTab state
    content = re.sub(r"const \[activeTab, setActiveTab\] = useState<Tab>\('overview'\);\n?\s*", "", content)
    
    # 3. Replace Tabs wrapper and TabsList with the main Dashboard container
    tabs_start_pattern = r'<Tabs value=\{activeTab\}[^>]*>\s*<TabsList[^>]*>.*?</TabsList>'
    replacement_header = """<div className="space-y-16">
      <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mb-8">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Shield className="w-4 h-4" /> Operations Dashboard
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          All operation pipelines have been unified into a single dashboard. 
        </p>
      </div>"""
    content = re.sub(tabs_start_pattern, replacement_header, content, flags=re.DOTALL)
    
    # 4. Remove the closing </Tabs>
    idx = content.rfind("</Tabs>")
    if idx != -1:
        content = content[:idx] + "</div>" + content[idx+len("</Tabs>"):]

    # 5. Transform each <TabsContent value="xxx"> into a section header
    def replacer(match):
        val = match.group(1)
        # Create a nice title
        title = val.replace('_', ' ').title()
        if val == "potg": title = "POTG Parser"
        if val == "overview": title = "System Health"
        if val == "media": title = "Media Library"
        if val == "store": title = "Store Catalog"
        
        return f'<section id="{val}" className="space-y-6 pt-6"><h2 className="text-2xl font-display font-bold border-b border-border pb-2">{title}</h2><div className="space-y-4">'
        
    content = re.sub(r'<TabsContent value="([^"]+)">', replacer, content)
    
    # 6. Transform </TabsContent> into closing tags
    content = content.replace("</TabsContent>", "</div></section>")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Refactoring complete.")

if __name__ == '__main__':
    main()
