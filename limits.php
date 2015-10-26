<?php

    requireLogin();

    $username = $_SESSION['userdata']['username'];
    $pdo = \Fsl\Database::connect("slurm");
    $query = <<<EOT
            SELECT user, acct, grp_submit_jobs, grp_tres, grp_wall, grp_tres_run_mins
            FROM fsl_assoc_table
            WHERE (acct=? OR parent_acct=?) AND NOT deleted AND parent_acct != 'root'
            ORDER BY user='', user;
EOT;
    $statement = $pdo->prepare($query);
    $statement->execute(array($username, $username));
    $result = $statement->fetchAll();

    header('Content-Type: application/json');
    echo json_encode( array("rows" => $result) );
