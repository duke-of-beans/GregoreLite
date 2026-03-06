// AEGIS Profile Engine — Sprint 16.0
// Ported from profiles/registry.ts + profiles/manager.ts + profiles/loader.ts.
// Loads profiles from YAML, tracks active profile, handles switching.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::types::{ProfileDefinition, ProfileSummary};

/// Wraps a YAML profile file's top-level `profile:` key.
#[derive(Debug, serde::Deserialize)]
struct ProfileFile {
    profile: ProfileDefinition,
}

pub struct ProfileEngine {
    profiles_dir: PathBuf,
    profiles: HashMap<String, ProfileDefinition>,
    profile_order: Vec<String>,
    active_profile: String,
    previous_profile: Option<String>,
}

impl ProfileEngine {
    pub fn new(profiles_dir: PathBuf, default_profile: String, profile_order: Vec<String>) -> Self {
        Self {
            profiles_dir,
            profiles: HashMap::new(),
            profile_order,
            active_profile: default_profile,
            previous_profile: None,
        }
    }

    /// Load all .yaml/.yml files from the profiles directory.
    pub fn load(&mut self) -> Result<(), String> {
        let entries = fs::read_dir(&self.profiles_dir)
            .map_err(|e| format!("Failed to read profiles dir: {e}"))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "yaml" && ext != "yml" {
                continue;
            }

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            match self.load_profile_file(&path) {
                Ok(profile) => {
                    self.profiles.insert(name, profile);
                }
                Err(e) => {
                    eprintln!("[aegis] Failed to load profile {}: {}", path.display(), e);
                }
            }
        }

        Ok(())
    }

    fn load_profile_file(&self, path: &Path) -> Result<ProfileDefinition, String> {
        let content =
            fs::read_to_string(path).map_err(|e| format!("read error: {e}"))?;
        let file: ProfileFile =
            serde_yaml::from_str(&content).map_err(|e| format!("yaml parse error: {e}"))?;
        Ok(file.profile)
    }

    /// Switch to a named profile. Returns the new profile or error.
    pub fn switch(&mut self, name: &str) -> Result<&ProfileDefinition, String> {
        if !self.profiles.contains_key(name) {
            return Err(format!("Profile not found: {name}"));
        }
        self.previous_profile = Some(self.active_profile.clone());
        self.active_profile = name.to_string();
        Ok(self.profiles.get(name).unwrap())
    }

    pub fn active(&self) -> Option<&ProfileDefinition> {
        self.profiles.get(&self.active_profile)
    }

    pub fn active_name(&self) -> &str {
        &self.active_profile
    }

    pub fn previous_name(&self) -> Option<&str> {
        self.previous_profile.as_deref()
    }

    /// Build ordered list of profile summaries for the frontend.
    pub fn summaries(&self) -> Vec<ProfileSummary> {
        let mut result: Vec<ProfileSummary> = Vec::new();

        // Ordered profiles first
        for name in &self.profile_order {
            if let Some(p) = self.profiles.get(name) {
                result.push(ProfileSummary {
                    name: p.name.clone(),
                    display_name: p.display_name.clone(),
                    color: p.color.clone(),
                    description: p.description.clone(),
                    is_active: name == &self.active_profile,
                });
            }
        }

        // Then any profiles not in the explicit order
        for (name, p) in &self.profiles {
            if !self.profile_order.contains(name) {
                result.push(ProfileSummary {
                    name: p.name.clone(),
                    display_name: p.display_name.clone(),
                    color: p.color.clone(),
                    description: p.description.clone(),
                    is_active: name == &self.active_profile,
                });
            }
        }

        result
    }

    pub fn get(&self, name: &str) -> Option<&ProfileDefinition> {
        self.profiles.get(name)
    }
}
