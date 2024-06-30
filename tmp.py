import os

# 생성할 파일 이름 리스트
file_names = [
    "configure-your-site.adoc",
    "the-antora-playbook.adoc",
    "set-up-a-playbook.adoc",
    "site-keys.adoc",
    "site-url.adoc",
    "site-title.adoc",
    "site-start-page.adoc",
    "robots.adoc",
    "account-and-api-keys.adoc",
    "content-keys.adoc",
    "urls-for-content-sources.adoc",
    "urls-for-content-sources-private-repository-authentication.adoc",
    "branches.adoc",
    "worktrees.adoc",
    "tags.adoc",
    "single-start-path.adoc",
    "multiple-start-paths.adoc",
    "fallback-version.adoc",
    "edit-url.adoc",
    "refname-matching-in-content-sources.adoc",
    "git-keys.adoc",
    "git-repository-url-suffix.adoc",
    "git-fetch-concurrency-limit.adoc",
    "git-read-concurrency-limit.adoc",
    "git-credentials-path-and-contents.adoc",
    "git-plugins.adoc",
    "asciidoc-keys.adoc",
    "assign-attributes-to-a-site.adoc",
    "asciidoctor-extensions.adoc",
    "file-and-line-number-information.adoc",
    "ui-keys.adoc",
    "ui-bundle-url.adoc",
    "supplemental-ui.adoc",
    "ui-output-directory.adoc",
    "default-layout-for-pages.adoc",
    "urls-keys.adoc",
    "html-extension-styles.adoc",
    "latest-version-segment.adoc",
    "latest-prerelease-version-segment.adoc",
    "latest-version-segment-strategy.adoc",
    "redirect-facility-key.adoc",
    "output-keys.adoc",
    "output-directory.adoc",
    "archive-provider.adoc",
    "filesystem-provider.adoc",
    "custom-provider.adoc",
    "runtime-keys.adoc",
    "runtime-keys-log-keys.adoc",
    "log-severity-level.adoc",
    "log-failure-level.adoc",
    "log-format.adoc",
    "log-destination.adoc",
    "fetch-updates.adoc",
    "cache-directory.adoc",
    "network-keys.adoc",
    "network-proxy.adoc",
    "use-author-mode.adoc",
    "use-an-existing-playbook-project.adoc",
    "environment-variables.adoc"
]

folder_path = os.path.dirname(os.path.abspath(__file__))

# 폴더가 없으면 생성
if not os.path.exists(folder_path):
    os.makedirs(folder_path)

# 각 파일 생성
for file_name in file_names:
    file_path = os.path.join(folder_path, file_name)
    content = f"= {file_name}\n\n"  # 파일명을 제목으로 사용
    with open(file_path, 'w') as file:
        file.write(content)

print("Files created successfully.")