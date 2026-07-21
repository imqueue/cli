/*!
 * @imqueue/cli Unit Tests: container registry providers
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import '../../mocks/index.js';
import { google } from '../../../src/providers/registry/google.js';
import { awsEcr } from '../../../src/providers/registry/aws-ecr.js';
import { azureAcr } from '../../../src/providers/registry/azure-acr.js';

function ctx(registry: any): any {
    return { name: 'my-svc', config: { registry } };
}

describe('container registry providers', () => {
    describe('google (Artifact Registry)', () => {
        const c = ctx({
            provider: 'google',
            region: 'europe-west1',
            project: 'proj',
            namespace: 'repo',
        });

        it('should build the artifact registry image ref', () => {
            assert.equal(
                google.imageRef(c),
                'europe-west1-docker.pkg.dev/proj/repo/my-svc',
            );
        });

        it('should log in with the region host and json key', () => {
            assert.match(google.loginCmd(c), /europe-west1-docker\.pkg\.dev/);
            assert.match(google.loginCmd(c), /_json_key/);
        });

        it('should declare required options and a GCP_SA_KEY secret', () => {
            assert.deepEqual(
                google.options?.map(o => o.key),
                ['region', 'project', 'namespace'],
            );
            assert.equal(google.secretSpecs(c)[0].name, 'GCP_SA_KEY');
        });
    });

    describe('aws-ecr', () => {
        const c = ctx({
            provider: 'aws-ecr',
            region: 'us-east-1',
            accountId: '123456789012',
        });

        it('should build the ECR image ref', () => {
            assert.equal(
                awsEcr.imageRef(c),
                '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-svc',
            );
        });

        it('should log in via get-login-password', () => {
            assert.match(awsEcr.loginCmd(c), /aws ecr get-login-password/);
            assert.match(awsEcr.loginCmd(c), /us-east-1/);
        });

        it('should require region and accountId', () => {
            assert.deepEqual(
                awsEcr.options?.filter(o => o.required).map(o => o.key),
                ['region', 'accountId'],
            );
        });
    });

    describe('azure-acr', () => {
        const c = ctx({ provider: 'azure-acr', namespace: 'myacr' });

        it('should build the ACR image ref', () => {
            assert.equal(azureAcr.imageRef(c), 'myacr.azurecr.io/my-svc');
        });

        it('should log in to the acr host', () => {
            assert.match(azureAcr.loginCmd(c), /myacr\.azurecr\.io/);
        });

        it('should declare azure secret specs', () => {
            assert.deepEqual(
                azureAcr.secretSpecs(c).map(s => s.name),
                ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'],
            );
        });
    });
});
