/**
 * Copyright 2013-2019 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const chalk = require('chalk');
const shelljs = require('shelljs');
const fs = require('fs');
const prompts = require('../kubernetes/prompts');
const writeFiles = require('./files').writeFiles;
const BaseDockerGenerator = require('../generator-base-docker');
const { loadFromYoRc, checkImages, generateJwtSecret, configureImageNames, setAppsFolderPaths } = require('../docker-base');
const statistics = require('../statistics');
const packagejs = require('../../package.json');

module.exports = class extends BaseDockerGenerator {
    get initializing() {
        return {
            sayHello() {
                this.log(chalk.white(`${chalk.bold('⎈')} Welcome to the JHipster Kubernetes Helm Generator ${chalk.bold('⎈')}`));
                this.log(chalk.white(`Files will be generated in folder: ${chalk.yellow(this.destinationRoot())}`));
            },

            ...super.initializing,

            checkKubernetes() {
                if (this.skipChecks) return;
                const done = this.async();

                shelljs.exec('helm version --client', { silent: true }, (code, stdout, stderr) => {
                    if (stderr) {
                        this.log(
                            `${chalk.yellow.bold('WARNING!')} helm 2.8 or later is not installed on your computer.\n` +
                                'Make sure you have helm installed. Read https://github.com/helm/helm/\n'
                        );
                    }
                    done();
                });
            },

            loadConfig() {
                loadFromYoRc.call(this);
                this.kubernetesNamespace = this.config.get('kubernetesNamespace');
                this.kubernetesServiceType = this.config.get('kubernetesServiceType');
                this.ingressDomain = this.config.get('ingressDomain');
                this.istio = this.config.get('istio');
                this.istioRoute = this.config.get('istioRoute');
                this.jhipsterVersion = packagejs.version;
                this.dbRandomPassword = Math.random()
                    .toString(36)
                    .slice(-8);
            }
        };
    }

    get prompting() {
        return {
            askForApplicationType: prompts.askForApplicationType,
            askForPath: prompts.askForPath,
            askForApps: prompts.askForApps,
            askForMonitoring: prompts.askForMonitoring,
            askForClustersMode: prompts.askForClustersMode,
            askForServiceDiscovery: prompts.askForServiceDiscovery,
            askForAdminPassword: prompts.askForAdminPassword,
            askForKubernetesNamespace: prompts.askForKubernetesNamespace,
            askForDockerRepositoryName: prompts.askForDockerRepositoryName,
            askForDockerPushCommand: prompts.askForDockerPushCommand,
            askForIstioSupport: prompts.askForIstioSupport,
            askForIstioRouteFiles: prompts.askForIstioRouteFiles,
            askForKubernetesServiceType: prompts.askForKubernetesServiceType,
            askForIngressDomain: prompts.askForIngressDomain
        };
    }

    get configuring() {
        return {
            insight() {
                statistics.sendSubGenEvent('generator', 'kubernetes-helm');
            },

            checkImages,
            generateJwtSecret,
            configureImageNames,
            setAppsFolderPaths,

            setPostPromptProp() {
                this.appConfigs.forEach(element => {
                    element.clusteredDb ? (element.dbPeerCount = 3) : (element.dbPeerCount = 1);
                    if (element.messageBroker === 'kafka') {
                        this.useKafka = true;
                    }
                });
            },

            saveConfig() {
                this.config.set({
                    appsFolders: this.appsFolders,
                    directoryPath: this.directoryPath,
                    clusteredDbApps: this.clusteredDbApps,
                    serviceDiscoveryType: this.serviceDiscoveryType,
                    jwtSecretKey: this.jwtSecretKey,
                    dockerRepositoryName: this.dockerRepositoryName,
                    dockerPushCommand: this.dockerPushCommand,
                    kubernetesNamespace: this.kubernetesNamespace,
                    kubernetesServiceType: this.kubernetesServiceType,
                    ingressDomain: this.ingressDomain,
                    monitoring: this.monitoring,
                    istio: this.istio,
                    istioRoute: this.istioRoute
                });
            }
        };
    }

    get writing() {
        return writeFiles();
    }

    end() {
        if (this.warning) {
            this.log(`\n${chalk.yellow.bold('WARNING!')} Helm configuration generated, but no Jib cache found`);
            this.log('If you forgot to generate the Docker image for this application, please run:');
            this.log(this.warningMessage);
        } else {
            this.log(`\n${chalk.bold.green('Helm configuration successfully generated!')}`);
        }

        this.log(
            `${chalk.yellow.bold(
                'WARNING!'
            )} You will need to push your image to a registry. If you have not done so, use the following commands to tag and push the images:`
        );
        for (let i = 0; i < this.appsFolders.length; i++) {
            const originalImageName = this.appConfigs[i].baseName.toLowerCase();
            const targetImageName = this.appConfigs[i].targetImageName;
            if (originalImageName !== targetImageName) {
                this.log(`  ${chalk.cyan(`docker image tag ${originalImageName} ${targetImageName}`)}`);
            }
            this.log(`  ${chalk.cyan(`${this.dockerPushCommand} ${targetImageName}`)}`);
        }

        this.log('\nYou can deploy all your apps by running the following script:');
        this.log(`  ${chalk.cyan('bash helm-apply.sh')}`);

        this.log('\nYou can upgrade (after any changes) all your apps by running the following script:');
        this.log(`  ${chalk.cyan('bash helm-upgrade.sh')}`);

        // Make the apply script executable
        try {
            fs.chmodSync('helm-apply.sh', '755');
            fs.chmodSync('helm-upgrade.sh', '755');
        } catch (err) {
            this.log(
                `${chalk.yellow.bold(
                    'WARNING!'
                )}Failed to make 'helm-apply.sh', 'helm-upgrade.sh' executable, you may need to run 'chmod +x helm-apply.sh helm-upgrade.sh`
            );
        }
    }
};
