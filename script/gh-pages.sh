
set -e

# checkout the `gh-pages` branch or create it if it does not exist
git checkout gh-pages || git checkout -b gh-pages

# checkout the files from `master`, without actually changing the branch
git checkout master -- .

# clean up built (tests also use built), but retain `define.js`
shopt -s extglob
(cd built && rm -rf -- !(define.js))

# compile
tsc

# clean up unnecessary files
rm -rf src test script .gitignore tsconfig.json package.json package-lock.json README.md
echo '.DS_Store' > .gitignore
echo 'node_modules' >> .gitignore

# add only already tracked files and `{built, img}`
git add -u
git add -- built img

# do not fail if there were no changes
(git commit -m 'Regenerate gh-pages' || true)
git checkout master
