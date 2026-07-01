import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import githubActionsPlugin from '@backstage-community/plugin-github-actions/alpha';
import jiraPlugin from '@axis-backstage/plugin-jira-dashboard/alpha';
import kubernetesPlugin from '@backstage/plugin-kubernetes/alpha';
import { navModule } from './modules/nav';
import { incidentsPlugin } from './modules/incidents';

export default createApp({
  features: [
    catalogPlugin,
    githubActionsPlugin,
    jiraPlugin,
    kubernetesPlugin,
    incidentsPlugin,
    navModule,
  ],
});
