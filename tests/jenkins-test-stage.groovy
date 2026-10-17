stage('Backend unit tests') {
    steps {
        powershell '''
            $ErrorActionPreference = 'Stop'
            $testSource = 'D:/Projects Version2/EAD Project/SmartSolarMicrogrid/tests/SmartSolarMicrogrid.Tests'
            $testTarget = "$env:WORKSPACE/tests/SmartSolarMicrogrid.Tests"
            New-Item -ItemType Directory -Path $testTarget -Force | Out-Null
            Copy-Item -LiteralPath "$testSource/SmartSolarMicrogrid.Tests.csproj", "$testSource/StationDeactivationTests.cs" -Destination $testTarget -Force
            & "$env:LOCALAPPDATA/Microsoft/dotnet/dotnet.exe" test "$testTarget/SmartSolarMicrogrid.Tests.csproj" -c Release --logger 'trx;LogFileName=backend-tests.trx' --logger 'console;verbosity=normal' --results-directory "$env:WORKSPACE/TestResults"
            exit $LASTEXITCODE
        '''
    }
    post {
        always {
            archiveArtifacts artifacts: 'TestResults/*.trx', allowEmptyArchive: true
        }
    }
}
