fn main() {
    tauri_build::build();

    // Windows: Embed Common Controls v6 manifest for test binaries
    //
    // When running `cargo test`, the generated test executables don't include
    // the standard Tauri application manifest. Without Common Controls v6,
    // `tauri::test` calls fail with STATUS_ENTRYPOINT_NOT_FOUND.
    //
    // This workaround:
    // 1. Embeds the manifest into test binaries via /MANIFEST:EMBED
    // 2. Uses /MANIFEST:NO for the main binary to avoid duplicate resources
    //    (Tauri already handles manifest embedding for the app binary)
    #[cfg(target_os = "windows")]
    {
        let manifest_path = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"),
        )
        .join("common-controls.manifest");
        let manifest_arg = format!("/MANIFESTINPUT:{}", manifest_path.display());

        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg={}", manifest_arg);
        // Avoid duplicate manifest resources in binary builds.
        println!("cargo:rustc-link-arg-bins=/MANIFEST:NO");
        println!("cargo:rerun-if-changed={}", manifest_path.display());
    }

    let tag = compute_build_tag();
    println!("cargo:rustc-env=BUILD_TAG={}", tag);
    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-changed=.git/refs");
    println!("cargo:rerun-if-changed=.git/index");
    println!("cargo:rerun-if-env-changed=CC_SWITCH_TAG");
}

// ---------------------------------------------------------------------------
// compute_build_tag() — determine the build tag from env or git describe
// ---------------------------------------------------------------------------
fn compute_build_tag() -> String {
    // 1) CC_SWITCH_TAG env — ignore empty string
    if let Ok(v) = std::env::var("CC_SWITCH_TAG") {
        let v = v.trim().to_string();
        if !v.is_empty() {
            return normalize(&v);
        }
    }
    // 2) git describe --tags --dirty --long
    match std::process::Command::new("git")
        .args(["describe", "--tags", "--dirty", "--long"])
        .output()
    {
        Ok(out) if out.status.success() => {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            normalize(&s)
        }
        _ => "dev".to_string(),
    }
}

// ---------------------------------------------------------------------------
// normalize() — shared between build.rs (build-time) and lib.rs (test-time)
// via `include!()`.  Keep the canonical copy here.
// ---------------------------------------------------------------------------
fn normalize(raw: &str) -> String {
    let (core, is_dirty) = match raw.strip_suffix("-dirty") {
        Some(c) => (c, true),
        None => (raw, false),
    };
    let (base, behind) = match core.split_once("-g") {
        Some((b, _hash)) => {
            if let Some((tag, n)) = b.rsplit_once('-') {
                if n.chars().all(|c| c.is_ascii_digit()) {
                    (tag, Some(n))
                } else {
                    (b, None)
                }
            } else {
                (b, None)
            }
        }
        None => (core, None),
    };
    let stripped = base.strip_prefix('v').unwrap_or(base);
    match (behind, is_dirty) {
        (Some(n), true) => format!("v{}-{}-dirty", stripped, n),
        (Some(n), false) => format!("v{}-{}", stripped, n),
        (None, true) => format!("v{}-dirty", stripped),
        (None, false) => format!("v{}", stripped),
    }
}
