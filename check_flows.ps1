$job = Start-Job -ScriptBlock {
    Set-Location 'C:\Users\Divyanshu\OneDrive\Desktop\Work\Online_Coding_Platform'
    node src/index.js
}

Start-Sleep -Seconds 5

$email = 'codex.flow.' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '@example.com'
$password = 'StrongPass1!'
$results = [ordered]@{}

try {
    Write-Output 'STEP register'
    $registerBody = @{ firstName = 'Codex Tester'; emailID = $email; password = $password } | ConvertTo-Json
    $register = Invoke-WebRequest -Uri 'http://localhost:3000/user/register' -Method Post -ContentType 'application/json' -Body $registerBody -SessionVariable sess -ErrorAction Stop
    $results.register = ($register.Content | ConvertFrom-Json)

    Write-Output 'STEP check-after-register'
    $check1 = Invoke-WebRequest -Uri 'http://localhost:3000/user/check' -WebSession $sess -ErrorAction Stop
    $results.checkAfterRegister = ($check1.Content | ConvertFrom-Json)

    Write-Output 'STEP get-all-problems'
    $allProblemsResp = Invoke-WebRequest -Uri 'http://localhost:3000/problem/getAllProblem' -WebSession $sess -ErrorAction Stop
    $allProblems = ($allProblemsResp.Content | ConvertFrom-Json)
    $results.allProblemsCount = $allProblems.count

    Write-Output 'STEP subject-stats'
    $subjectStatsResp = Invoke-WebRequest -Uri 'http://localhost:3000/problem/subjectStats' -WebSession $sess -ErrorAction Stop
    $results.subjectStats = ($subjectStatsResp.Content | ConvertFrom-Json).stats

    Write-Output 'STEP dsa-list'
    $dsaResp = Invoke-WebRequest -Uri 'http://localhost:3000/problem/bySubject/DSA' -WebSession $sess -ErrorAction Stop
    $dsaProblems = ($dsaResp.Content | ConvertFrom-Json)
    $results.dsaCount = $dsaProblems.count

    Write-Output 'STEP other-subjects'
    $otherSubjects = @('DAA', 'OOPs', 'CProgramming')
    $otherCounts = @{}
    foreach ($subject in $otherSubjects) {
        $resp = Invoke-WebRequest -Uri ("http://localhost:3000/problem/bySubject/{0}" -f $subject) -WebSession $sess -ErrorAction Stop
        $payload = $resp.Content | ConvertFrom-Json
        $otherCounts[$subject] = $payload.count
    }
    $results.otherSubjectCounts = $otherCounts

    Write-Output 'STEP problem-detail'
    $problemId = $allProblems.problems[0]._id
    $problemResp = Invoke-WebRequest -Uri ("http://localhost:3000/problem/problemById/{0}" -f $problemId) -WebSession $sess -ErrorAction Stop
    $problemPayload = $problemResp.Content | ConvertFrom-Json
    $problem = $problemPayload.problem
    $results.problemDetail = [ordered]@{
        id = $problem._id
        title = $problem.title
        subject = $problem.subject
        difficulty = $problem.difficulty
        visibleCount = $problem.visibleTestCases.Count
        starterCount = $problem.startCode.Count
        solutionCount = $problem.referenceSolution.Count
    }

    Write-Output 'STEP solved-before'
    $solvedBefore = Invoke-WebRequest -Uri 'http://localhost:3000/problem/problemSolvedbyUser' -WebSession $sess -ErrorAction Stop
    $results.solvedBefore = (($solvedBefore.Content | ConvertFrom-Json).problems | Measure-Object).Count

    Write-Output 'STEP pick-js-solution'
    $jsSolution = $problem.referenceSolution | Where-Object { $_.language -eq 'JavaScript' } | Select-Object -First 1
    if (-not $jsSolution) {
        throw 'No JavaScript reference solution found for test problem'
    }

    Write-Output 'STEP run'
    $runBody = @{ code = $jsSolution.completeCode; language = 'javascript' } | ConvertTo-Json -Depth 5
    $runResp = Invoke-WebRequest -Uri ("http://localhost:3000/submission/run/{0}" -f $problemId) -Method Post -ContentType 'application/json' -Body $runBody -WebSession $sess -ErrorAction Stop
    $results.runResult = ($runResp.Content | ConvertFrom-Json)

    Write-Output 'STEP submit'
    $submitResp = Invoke-WebRequest -Uri ("http://localhost:3000/submission/submit/{0}" -f $problemId) -Method Post -ContentType 'application/json' -Body $runBody -WebSession $sess -ErrorAction Stop
    $results.submitResult = ($submitResp.Content | ConvertFrom-Json)

    Write-Output 'STEP solved-after'
    $solvedAfter = Invoke-WebRequest -Uri 'http://localhost:3000/problem/problemSolvedbyUser' -WebSession $sess -ErrorAction Stop
    $results.solvedAfter = (($solvedAfter.Content | ConvertFrom-Json).problems | Measure-Object).Count

    Write-Output 'STEP submission-history'
    $subHistory = Invoke-WebRequest -Uri ("http://localhost:3000/problem/submittedProblem/{0}" -f $problemId) -WebSession $sess -ErrorAction Stop
    $submissions = ($subHistory.Content | ConvertFrom-Json).submissions
    $results.submissionHistoryCount = ($submissions | Measure-Object).Count
    if ($submissions) {
        $latest = $submissions[0]
        $results.latestSubmission = [ordered]@{
            status = $latest.status
            language = $latest.language
            passed = $latest.testCasesPassed
            total = $latest.testCasesTotal
        }
    }

    Write-Output 'STEP logout'
    $logout = Invoke-WebRequest -Uri 'http://localhost:3000/user/logout' -Method Post -WebSession $sess -ErrorAction Stop
    $results.logout = ($logout.Content | ConvertFrom-Json)

    Write-Output 'STEP check-after-logout'
    try {
        Invoke-WebRequest -Uri 'http://localhost:3000/user/check' -WebSession $sess -ErrorAction Stop | Out-Null
        $results.checkAfterLogout = 'unexpectedly-authorized'
    }
    catch {
        $results.checkAfterLogout = $_.ErrorDetails.Message
    }

    Write-Output 'STEP frontend-root'
    $frontend = Invoke-WebRequest -Uri 'http://localhost:5173' -ErrorAction Stop
    $results.frontendStatus = $frontend.StatusCode

    $results.testUser = $email
    $results | ConvertTo-Json -Depth 10
}
catch {
    Write-Output 'FLOW_ERROR'
    Write-Output ('AT=' + $results.Keys.Count)
    Write-Output $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Output $_.ErrorDetails.Message
    }
}
finally {
    Write-Output "`n--- JOB OUTPUT ---"
    Receive-Job $job -Keep
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
}
