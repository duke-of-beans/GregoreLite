// Ghost Thread — Exclusion Engine
//
// should_exclude(path) MUST walk every component of the path, not just
// the filename. A file at node_modules/lodash/src/index.ts must be
// excluded even though the filename itself is not on any exclusion list.

use std::path::Path;

/// Directory name components that are always excluded (case-insensitive match).
const EXCLUDED_DIR_COMPONENTS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".ssh",
    ".gnupg",
    "secrets",
    "vault",
    "private",
    "personal",
    "medical",
    "legal",
];

/// File extensions that are security-sensitive and always excluded.
const SECURITY_EXTENSIONS: &[&str] = &["pem", "key", "p12", "pfx", "cer", "crt"];

/// Filename patterns (substrings, case-insensitive) that are always excluded.
const EXCLUDED_FILENAME_KEYWORDS: &[&str] =
    &["password", "secret", "token", "credential"];

/// Only these file extensions are allowed through. Everything else is excluded.
const ALLOWED_EXTENSIONS: &[&str] = &[
    "txt", "md", "ts", "tsx", "js", "py", "rs", "go",
    "java", "sql", "json", "yaml", "yml", "pdf", "docx",
];

/// Returns true if the path should be excluded from Ghost indexing.
///
/// Enforcement order:
///   1. Walk every path component for excluded directory names
///   2. Check security-sensitive extensions
///   3. Check filename keyword patterns (password, secret, token, credential)
///   4. Check dotfiles with no extension (e.g., .env)
///   5. Allow only files whose extension is in ALLOWED_EXTENSIONS
pub fn should_exclude(path: &Path) -> bool {
    // ── Step 1: Walk every component ────────────────────────────────────────
    for component in path.components() {
        let s = component.as_os_str().to_string_lossy().to_lowercase();
        if EXCLUDED_DIR_COMPONENTS.iter().any(|&d| s == d) {
            return true;
        }
    }

    // ── Steps 2-5: Filename-level checks ────────────────────────────────────
    if let Some(filename) = path.file_name() {
        let name = filename.to_string_lossy().to_lowercase();

        // Step 2: Security-sensitive extensions (.pem, .key, etc.)
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if SECURITY_EXTENSIONS.contains(&ext_str.as_str()) {
                return true;
            }
        }

        // Step 3: Filename keyword patterns
        for &kw in EXCLUDED_FILENAME_KEYWORDS {
            if name.contains(kw) {
                return true;
            }
        }

        // Step 4: Dotfiles with no extension (e.g., .env, .gitignore)
        // In Rust, Path::new(".env").extension() returns None
        if path.extension().is_none() {
            // Exclude dotfiles (start with '.') and files with no extension at all
            return name.starts_with('.') || !name.contains('.');
        }
    } else {
        // No filename component (shouldn't happen for regular files, but be safe)
        return true;
    }

    // ── Step 5: Extension allowlist ─────────────────────────────────────────
    match path.extension() {
        Some(ext) => {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            !ALLOWED_EXTENSIONS.contains(&ext_lower.as_str())
        }
        None => true, // no extension → excluded (already handled above, but belt-and-suspenders)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // ── Directory component exclusions ───────────────────────────────────────

    #[test]
    fn excludes_node_modules_at_root() {
        assert!(should_exclude(&PathBuf::from("node_modules/lodash/index.ts")));
    }

    #[test]
    fn excludes_node_modules_deeply_nested() {
        assert!(should_exclude(&PathBuf::from(
            "D:/Dev/myproject/node_modules/lodash/src/index.ts"
        )));
    }

    #[test]
    fn excludes_git_dir() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/myproject/.git/config")));
    }

    #[test]
    fn excludes_target_dir() {
        assert!(should_exclude(&PathBuf::from(
            "D:/Dev/myproject/target/debug/build/something.rs"
        )));
    }

    #[test]
    fn excludes_secrets_dir() {
        assert!(should_exclude(&PathBuf::from(
            "D:/Dev/myproject/secrets/api.json"
        )));
    }

    #[test]
    fn excludes_private_dir() {
        assert!(should_exclude(&PathBuf::from("D:/Documents/private/notes.md")));
    }

    // ── File extension exclusions ────────────────────────────────────────────

    #[test]
    fn excludes_pem_file() {
        assert!(should_exclude(&PathBuf::from("D:/certs/server.pem")));
    }

    #[test]
    fn excludes_key_file() {
        assert!(should_exclude(&PathBuf::from("D:/certs/private.key")));
    }

    #[test]
    fn excludes_p12_file() {
        assert!(should_exclude(&PathBuf::from("D:/certs/client.p12")));
    }

    // ── .env and dotfile exclusions ──────────────────────────────────────────

    #[test]
    fn excludes_dot_env_file() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/myproject/.env")));
    }

    #[test]
    fn excludes_env_local() {
        // .env.local has extension "local" → not in allowed list → excluded
        assert!(should_exclude(&PathBuf::from("D:/Dev/myproject/.env.local")));
    }

    // ── Filename keyword exclusions ──────────────────────────────────────────

    #[test]
    fn excludes_password_in_filename() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/passwords.json")));
    }

    #[test]
    fn excludes_secret_in_filename() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/api-secret-key.ts")));
    }

    #[test]
    fn excludes_token_in_filename() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/auth-token.json")));
    }

    #[test]
    fn excludes_credential_in_filename() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/credentials.yaml")));
    }

    // ── Allowed paths ────────────────────────────────────────────────────────

    #[test]
    fn allows_normal_ts_file() {
        assert!(!should_exclude(&PathBuf::from(
            "D:/Dev/myproject/src/index.ts"
        )));
    }

    #[test]
    fn allows_rust_file() {
        assert!(!should_exclude(&PathBuf::from(
            "D:/Projects/myapp/src/main.rs"
        )));
    }

    #[test]
    fn allows_markdown_file() {
        assert!(!should_exclude(&PathBuf::from("D:/Dev/myproject/README.md")));
    }

    #[test]
    fn allows_python_file() {
        assert!(!should_exclude(&PathBuf::from("D:/Dev/scripts/run.py")));
    }

    #[test]
    fn allows_json_config() {
        assert!(!should_exclude(&PathBuf::from(
            "D:/Dev/myproject/tsconfig.json"
        )));
    }

    #[test]
    fn allows_yaml_file() {
        assert!(!should_exclude(&PathBuf::from(
            "D:/Dev/myproject/.github/workflows/ci.yml"
        )));
    }

    // ── Extension allowlist enforcement ─────────────────────────────────────

    #[test]
    fn excludes_binary_file() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/myapp/app.exe")));
    }

    #[test]
    fn excludes_zip_file() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/myapp/archive.zip")));
    }

    #[test]
    fn excludes_png_file() {
        assert!(should_exclude(&PathBuf::from("D:/Dev/myapp/logo.png")));
    }
}
