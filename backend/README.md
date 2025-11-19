
#DEVELOPMENT TIPS:
## Project Setup

After cloning the repository, run the setup script to configure Git hooks:

```sh
./setup.sh
```

#### If you have problems committing while using nvm do:
sudo ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/node" "/usr/local/bin/node"
sudo ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/npm" "/usr/local/bin/npm"
sudo ln -s "$NVM_DIR/versions/node/$(nvm version)/bin/npx" "/usr/local/bin/npx"




## To create a new migration file:
```
> npm run migration:create -- <migration-name>
```
