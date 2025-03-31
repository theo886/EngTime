import os
import sys
import subprocess

################################################################################
# 1) Configuration
################################################################################

# Directories to skip entirely (won’t even prompt).
DEFAULT_IGNORE_DIRS = {'.git', 'node_modules', '__pycache__'}

# File extensions to skip by default (won’t even prompt).
DEFAULT_IGNORE_EXTENSIONS = {'.pyc', '.o', '.exe'}

# Filenames to skip by default (known sensitive config, etc.).
IGNORE_FILE_NAMES = {
    'local.settings.json',  # skip exactly this filename
}

################################################################################
# 2) Token Approximation
################################################################################

def approximate_token_count(text):
    """
    A naive token counter that just splits on whitespace.
    For a real GPT-3.5/GPT-4 estimate, use an official tokenizer library.
    """
    return len(text.split())

################################################################################
# 3) Building the Full Tree
################################################################################

def build_tree_structure(path):
    """
    Create a nested dictionary representing the folder structure:
    
      {
        'name': 'folder_or_file_name',
        'path': '/full/path/to/this',
        'type': 'dir' or 'file',
        'children': [],
        'approx_tokens_if_included': int (set later)
      }
    """
    name = os.path.basename(path) or path
    if os.path.isfile(path):
        return {
            'name': name,
            'path': path,
            'type': 'file',
            'children': [],
            'approx_tokens_if_included': 0
        }
    
    node = {
        'name': name,
        'path': path,
        'type': 'dir',
        'children': [],
        'approx_tokens_if_included': 0
    }
    try:
        entries = sorted(os.listdir(path))
    except OSError:
        # If we can't read the directory, treat it as empty
        return node
    
    for e in entries:
        full_e = os.path.join(path, e)
        node['children'].append(build_tree_structure(full_e))
    return node

################################################################################
# 4) Pruning Ignored Items (before token calculation)
################################################################################

def prune_ignored_items(node):
    """
    Remove any directories/files we should skip entirely (default ignores).
    Returns the same node but possibly with children pruned.
    """
    if node['type'] == 'file':
        # If file is in ignored names or has an ignored extension, remove it
        filename = node['name']
        if filename in IGNORE_FILE_NAMES:
            return None
        _, ext = os.path.splitext(filename)
        if ext.lower() in DEFAULT_IGNORE_EXTENSIONS:
            return None
        return node  # keep file if not ignored
    
    if node['type'] == 'dir':
        # If the directory itself is in ignore list, drop it
        if node['name'] in DEFAULT_IGNORE_DIRS:
            return None
        
        kept_children = []
        for child in node['children']:
            pruned = prune_ignored_items(child)
            if pruned is not None:
                kept_children.append(pruned)
        node['children'] = kept_children
        return node

    return None

################################################################################
# 5) Calculating "Full Inclusion" Token Count for Each Node
################################################################################

def build_potential_output(node, root_path, prefix="", is_last=True):
    """
    Recursively build the text lines that would appear if we included
    this node (and all its children) in the final output. This includes
    lines for the <file_map> plus the file contents for <file_contents>.
    
    We combine them into a single text block just for counting tokens.
    """
    lines = []
    
    connector = "└── " if is_last else "├── "
    if not prefix and node.get('parent') is None:
        # For the root node, let's display the full path
        lines.append(node['path'])
    else:
        lines.append(prefix + connector + node['name'])
    
    if node['type'] == 'dir':
        # Recurse into children
        new_prefix = prefix + ("    " if is_last else "│   ")
        count_children = len(node['children'])
        for idx, child in enumerate(node['children']):
            child_is_last = (idx == count_children - 1)
            child_lines = build_potential_output(
                child, root_path, prefix=new_prefix, is_last=child_is_last
            )
            lines.extend(child_lines)
    else:
        # It's a file: produce a code block
        rel_path = os.path.relpath(node['path'], start=root_path)
        _, ext = os.path.splitext(node['path'])
        code_fence = ext.lstrip('.') or 'text'
        
        lines.append(f"File: {rel_path}")
        lines.append(f"```{code_fence}")
        try:
            with open(node['path'], 'r', encoding='utf-8', errors='replace') as f:
                contents = f.read()
        except Exception:
            contents = ""
        lines.append(contents)
        lines.append("```\n")
    
    return lines

def compute_subtree_token_count(node, root_path):
    """
    Construct the text that would result if we included this node and
    all its children, then approximate the token count.
    """
    lines = build_potential_output(node, root_path)
    text = "\n".join(lines)
    return approximate_token_count(text)

def compute_tokens_for_all_nodes(node, root_path):
    """
    Recursively compute and store `approx_tokens_if_included` for
    this node *and all its children*, to display in the interactive prompt.
    """
    node['approx_tokens_if_included'] = compute_subtree_token_count(node, root_path)
    if node['type'] == 'dir':
        for child in node['children']:
            compute_tokens_for_all_nodes(child, root_path)

################################################################################
# 6) Interactive Exclusion (User Choices)
################################################################################

def prompt_for_exclusions(options, context_msg):
    """
    Given a list of option display strings, show them and let the user
    pick which indices to exclude.
    """
    if not options:
        return set()
    
    print(f"\n{context_msg}")
    for i, opt in enumerate(options):
        print(f"  [{i}] {opt}")
    
    print("\nType the indices of items you want to EXCLUDE, comma-separated.")
    print("Or press Enter to exclude none (keep them all).")
    choice = input("Exclude indices: ").strip()
    
    if not choice:
        return set()
    
    excluded_indices = set()
    try:
        for c in choice.split(','):
            idx = int(c.strip())
            if 0 <= idx < len(options):
                excluded_indices.add(idx)
    except ValueError:
        pass
    
    return excluded_indices

def interactive_prune_tree(node, root_path):
    """
    Recursively ask the user which subdirectories/files to exclude.
    We'll show each child's name plus approximate tokens if fully included.
    """
    if node['type'] == 'file':
        # Single file; no sub-items to prune
        return node
    
    # It's a directory
    dirs = [c for c in node['children'] if c['type'] == 'dir']
    files = [c for c in node['children'] if c['type'] == 'file']
    
    # Prompt about subdirectories
    if dirs:
        dir_names = [
            f"{d['name']} (≈{d['approx_tokens_if_included']} tokens)"
            for d in dirs
        ]
        exclude_dirs = prompt_for_exclusions(
            dir_names,
            f"In directory: {node['path']}\nSubdirectories found:"
        )
    else:
        exclude_dirs = set()
    
    kept_dirs = []
    for i, d in enumerate(dirs):
        if i not in exclude_dirs:
            pruned = interactive_prune_tree(d, root_path)
            if pruned is not None:
                kept_dirs.append(pruned)
    
    # Prompt about files
    if files:
        file_names = [
            f"{f['name']} (≈{f['approx_tokens_if_included']} tokens)"
            for f in files
        ]
        exclude_files = prompt_for_exclusions(
            file_names,
            f"In directory: {node['path']}\nFiles found:"
        )
    else:
        exclude_files = set()
    
    kept_files = []
    for i, f in enumerate(files):
        if i not in exclude_files:
            pruned = interactive_prune_tree(f, root_path)
            if pruned is not None:
                kept_files.append(pruned)
    
    node['children'] = kept_dirs + kept_files
    return node

################################################################################
# 7) Final Output
################################################################################

def generate_ascii_tree(node, prefix="", is_last=True):
    """
    Generate the final ASCII tree lines for <file_map>.
    """
    lines = []
    connector = "└── " if is_last else "├── "
    
    # For the root directory, print full path
    if not prefix and node.get('parent') is None:
        lines.append(node['path'])
    else:
        lines.append(prefix + connector + node['name'])
    
    if node['type'] == 'dir' and node['children']:
        new_prefix = prefix + ("    " if is_last else "│   ")
        child_count = len(node['children'])
        for i, child in enumerate(node['children']):
            child_is_last = (i == child_count - 1)
            lines.extend(generate_ascii_tree(child, prefix=new_prefix, is_last=child_is_last))
    
    return lines

def gather_file_paths(node, results=None):
    """
    Collect all file paths from the final pruned tree.
    """
    if results is None:
        results = []
    
    if node['type'] == 'file':
        results.append(node['path'])
    elif node['type'] == 'dir':
        for c in node['children']:
            gather_file_paths(c, results)
    
    return results

def create_file_contents_section(file_paths, root_path):
    """
    Build the <file_contents> section for all included files.
    """
    lines = ["<file_contents>"]
    
    for fpath in sorted(file_paths):
        rel_path = os.path.relpath(fpath, start=root_path)
        lines.append(f"File: {rel_path}")
        _, ext = os.path.splitext(fpath)
        code_fence = ext.lstrip('.') or 'text'
        
        lines.append(f"```{code_fence}")
        try:
            with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                contents = f.read()
        except Exception:
            contents = ""
        lines.append(contents)
        lines.append("```\n")
    
    lines.append("</file_contents>")
    return "\n".join(lines)

def copy_to_clipboard(text):
    import platform
    system = platform.system().lower()
    if system == 'darwin':  # macOS
        p = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
        p.communicate(input=text.encode('utf-8'))
    elif system == 'windows':
        p = subprocess.Popen(['clip'], stdin=subprocess.PIPE)
        p.communicate(input=text.encode('utf-8'))
    else:  # Linux or similar
        try:
            p = subprocess.Popen(['xclip', '-selection', 'clipboard'], stdin=subprocess.PIPE)
            p.communicate(input=text.encode('utf-8'))
        except FileNotFoundError:
            pass

################################################################################
# 8) Main Entry Point
################################################################################

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 RepoCopy.py /path/to/your/repo")
        sys.exit(1)
    
    repo_path = sys.argv[1]
    if not os.path.isdir(repo_path):
        print(f"Error: {repo_path} is not a valid directory.")
        sys.exit(1)
    
    print(f"\nStarting interactive selection in: {repo_path}\n")
    
    # 1. Build the full tree
    root_node = build_tree_structure(repo_path)
    root_node['parent'] = None
    
    # 2. Prune default-ignored items
    pruned_root = prune_ignored_items(root_node)
    if not pruned_root:
        print("All items ignored by default or invalid. Nothing to copy.")
        return
    
    # 3. Compute token usage for each node if fully included
    compute_tokens_for_all_nodes(pruned_root, repo_path)
    
    # 4. Interactive prune (exclusions), displaying approximate tokens
    final_tree = interactive_prune_tree(pruned_root, repo_path)
    if not final_tree:
        print("All items excluded. Nothing to copy.")
        return
    
    # 5. Ask user to confirm final token count
    final_tokens = compute_subtree_token_count(final_tree, repo_path)
    response = input(
        f"\nYour final selection is approximately {final_tokens} tokens. Proceed? (y/n): "
    ).strip().lower()
    
    if response not in ('y', 'yes'):
        print("Aborting. No output was copied.")
        return
    
    # 6. Generate <file_map>
    file_map_lines = generate_ascii_tree(final_tree, prefix="", is_last=True)
    file_map_section = "<file_map>\n" + "\n".join(file_map_lines) + "\n</file_map>"
    
    # 7. Gather final file paths and produce <file_contents>
    included_files = gather_file_paths(final_tree)
    file_contents_section = create_file_contents_section(included_files, root_path=repo_path)
    
    # 8. Combine and copy
    final_output = f"{file_map_section}\n\n{file_contents_section}"
    copy_to_clipboard(final_output)
    
    print("\nDone! The following content (file map + file contents) has been copied to your clipboard:")
    print("--------------------------------------------------")
    print(final_output)
    print("--------------------------------------------------")

if __name__ == "__main__":
    main()