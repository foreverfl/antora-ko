import os

# 생성할 파일 이름 리스트
file_names = [
    "configure-component-versions.adoc",
    "whats-a-component-version.adoc",
    "whats-antora-yml.adoc",
    "define-a-component-version.adoc",
    "name-key.adoc",
    "version-key.adoc",
    "customize-the-title.adoc",
    "customize-the-display-version.adoc",
    "identify-a-prerelease-version.adoc",
    "define-a-component-with-no-version.adoc",
    "assign-attributes-to-a-component-version.adoc",
    "choose-a-start-page.adoc",
    "assign-navigation-files-to-a-component-version.adoc",
    "version-facets.adoc",
    "how-component-versions-are-sorted.adoc",
    "distributed-component-versions.adoc"
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