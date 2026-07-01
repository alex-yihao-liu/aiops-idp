$ErrorActionPreference = 'Stop'

$kubeconfig = 'C:\Users\Administrator\.kube\config'
$context = 'default'
$processes = @()

$env:NO_PROXY = 'localhost,127.0.0.1,.svc,.cluster.local,kubernetes.default.svc'
$env:NODE_USE_ENV_PROXY = '1'

function Start-LocalPortForward {
    param(
        [string]$Namespace,
        [string]$Resource,
        [string]$Mapping
    )

    $arguments = @(
        '--kubeconfig', $kubeconfig,
        '--context', $context,
        'port-forward',
        '--namespace', $Namespace,
        $Resource,
        $Mapping
    )
    $process = Start-Process `
        -FilePath 'kubectl' `
        -ArgumentList $arguments `
        -WindowStyle Hidden `
        -PassThru
    $script:processes += $process
}

try {
    Start-LocalPortForward 'incident-system' 'svc/incident-agent' '8000:8000'
    Start-LocalPortForward 'monitoring' 'svc/monitoring-grafana' '3001:80'
    Start-LocalPortForward 'monitoring' 'svc/monitoring-kube-prometheus-prometheus' '9090:9090'

    Start-Sleep -Seconds 3
    corepack yarn start
}
finally {
    foreach ($process in $processes) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}
