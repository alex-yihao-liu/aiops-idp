import { useCallback, useEffect, useState } from 'react';
import { Content, Header, Page, Progress } from '@backstage/core-components';
import {
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
} from '@material-ui/core';
import HealingIcon from '@material-ui/icons/Healing';
import {
  PageBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';

type Incident = {
  id: string;
  created_at: string;
  status: string;
  service: string;
  source?: string;
  fingerprint?: string;
  jira_bug?: {
    issue_key?: string;
    summary?: string;
    priority?: string;
    status?: string;
  };
  alert?: {
    labels?: {
      alertname?: string;
      severity?: string;
    };
  };
  root_cause?: {
    diagnosis?: string;
    confidence?: number;
    mode?: string;
  };
  ai_analysis?: {
    status?: string;
    model?: string;
    explanation?: string;
  };
  proposed_action?: {
    runbook?: string;
    change?: string;
    requires_approval?: boolean;
  };
  remediation?: {
    action?: string;
    pr_url?: string;
    pr_number?: number;
    files_changed?: string[];
  };
  verification?: {
    success?: boolean;
    checks?: {
      stability_window?: {
        stable_seconds?: number;
      };
    };
  };
  acknowledgement?: {
    acknowledged_by?: string;
    timestamp?: string;
  };
};

function IncidentPage() {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [approving, setApproving] = useState<string>();
  const [acknowledging, setAcknowledging] = useState<string>();
  const [reanalyzing, setReanalyzing] = useState<string>();

  const loadIncidents = useCallback(async () => {
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');
      const response = await fetchApi.fetch(
        `${proxyUrl}/incident-agent/incidents`,
      );
      if (!response.ok) {
        throw new Error(`Incident API returned HTTP ${response.status}`);
      }
      setIncidents(await response.json());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [discoveryApi, fetchApi]);

  useEffect(() => {
    loadIncidents();
    const timer = window.setInterval(loadIncidents, 15_000);
    return () => window.clearInterval(timer);
  }, [loadIncidents]);

  const approve = async (incidentId: string) => {
    setApproving(incidentId);
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');
      const response = await fetchApi.fetch(
        `${proxyUrl}/incident-agent/incidents/${incidentId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved_by: 'backstage-guest' }),
        },
      );
      if (!response.ok) {
        throw new Error(`Approval failed with HTTP ${response.status}`);
      }
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApproving(undefined);
    }
  };

  const acknowledge = async (incidentId: string) => {
    setAcknowledging(incidentId);
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');
      const response = await fetchApi.fetch(
        `${proxyUrl}/incident-agent/incidents/${incidentId}/acknowledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acknowledged_by: 'backstage-guest',
            note: 'Reviewed in Backstage',
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Acknowledge failed with HTTP ${response.status}`);
      }
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAcknowledging(undefined);
    }
  };

  const reanalyze = async (incidentId: string) => {
    setReanalyzing(incidentId);
    try {
      const proxyUrl = await discoveryApi.getBaseUrl('proxy');
      const response = await fetchApi.fetch(
        `${proxyUrl}/incident-agent/incidents/${incidentId}/reanalyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requested_by: 'backstage-guest',
            note: 'Reanalyze with latest deployment and Git evidence',
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Reanalysis failed with HTTP ${response.status}`);
      }
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReanalyzing(undefined);
    }
  };

  const canReanalyze = (status: string) =>
    !['collecting_evidence', 'remediating', 'verifying'].includes(status);

  return (
    <Page themeId="tool">
      <Header
        title="Incident Manager"
        subtitle="Evidence-backed RCA, controlled remediation, and recovery verification"
      />
      <Content>
        {loading && <Progress />}
        {error && <Typography color="error">{error}</Typography>}
        <Grid container spacing={3}>
          {incidents.map(incident => (
            <Grid item xs={12} md={6} key={incident.id}>
              <Card>
                <CardContent>
                  <Grid container spacing={1} alignItems="center" style={{ marginBottom: 8 }}>
                    <Grid item>
                      <Chip
                        label={incident.status}
                        size="small"
                        color={
                          incident.status === 'resolved' ? 'primary' :
                          incident.status === 'awaiting_approval' ? 'secondary' :
                          incident.status === 'needs_human' ? 'default' :
                          'default'
                        }
                      />
                    </Grid>
                    <Grid item>
                      <Chip
                        label={incident.source === 'jira_bug' ? 'Jira Bug' :
                               incident.source === 'grafana_alert' ? 'Alert' :
                               incident.source ?? 'unknown'}
                        size="small"
                        variant="outlined"
                      />
                    </Grid>
                    {incident.root_cause?.confidence !== undefined && (
                      <Grid item>
                        <Typography variant="caption">
                          {Math.round(incident.root_cause.confidence * 100)}% conf
                        </Typography>
                      </Grid>
                    )}
                    <Grid item>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(incident.created_at).toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>
                  <Typography variant="h6" gutterBottom>
                    {incident.jira_bug?.issue_key
                      ? `${incident.jira_bug.issue_key}: ${incident.service}`
                      : incident.alert?.labels?.alertname ?? incident.service}
                  </Typography>
                  {(incident.jira_bug?.summary || incident.alert?.labels?.severity) && (
                    <Typography variant="subtitle2" gutterBottom>
                      {incident.jira_bug?.summary ?? `Severity: ${incident.alert?.labels?.severity}`}
                    </Typography>
                  )}
                  <Typography variant="body2" color="textSecondary">
                    {incident.root_cause?.diagnosis ?? 'Collecting evidence...'}
                  </Typography>
                  <Typography variant="body2">
                    Runbook:{' '}
                    {incident.proposed_action?.runbook
                      ? `${incident.proposed_action.runbook} (${incident.proposed_action.change})`
                      : 'None'}
                  </Typography>
                  {incident.remediation?.pr_url && (
                    <Typography variant="body2">
                      PR:{' '}
                      <a href={incident.remediation.pr_url} target="_blank" rel="noreferrer">
                        #{incident.remediation.pr_number}
                      </a>
                    </Typography>
                  )}
                  {incident.verification?.success && (
                    <Typography variant="body2">
                      Verified, stable for{' '}
                      {incident.verification.checks?.stability_window?.stable_seconds ?? 0}s
                    </Typography>
                  )}
                  {incident.acknowledgement?.acknowledged_by && (
                    <Typography variant="body2">
                      Ack'd by {incident.acknowledgement.acknowledged_by}
                    </Typography>
                  )}
                  {incident.status === 'awaiting_approval' && (
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={approving === incident.id}
                      onClick={() => approve(incident.id)}
                    >
                      {approving === incident.id
                        ? 'Remediating...'
                        : 'Approve Runbook'}
                    </Button>
                  )}
                  {incident.status === 'needs_human' && (
                    <Button
                      variant="outlined"
                      color="primary"
                      disabled={acknowledging === incident.id}
                      onClick={() => acknowledge(incident.id)}
                    >
                      {acknowledging === incident.id
                        ? 'Acknowledging...'
                        : 'Acknowledge'}
                    </Button>
                  )}
                  {canReanalyze(incident.status) && (
                    <Button
                      variant="outlined"
                      color="default"
                      disabled={reanalyzing === incident.id}
                      onClick={() => reanalyze(incident.id)}
                    >
                      {reanalyzing === incident.id
                        ? 'Reanalyzing...'
                        : 'Reanalyze'}
                    </Button>
                  )}
                  <Typography variant="caption" display="block">
                    Incident: {incident.id}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Content>
    </Page>
  );
}

const incidentsPage = PageBlueprint.make({
  name: 'incidents',
  params: {
    path: '/incidents',
    title: 'Incidents',
    icon: <HealingIcon />,
    noHeader: true,
    loader: async () => <IncidentPage />,
  },
});

export const incidentsPlugin = createFrontendPlugin({
  pluginId: 'incidents',
  extensions: [incidentsPage],
});
