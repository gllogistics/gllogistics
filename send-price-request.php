<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars(trim($_POST['name']));
    $phone = htmlspecialchars(trim($_POST['phone']));
    $email = htmlspecialchars(trim($_POST['email']));
    $message = htmlspecialchars(trim($_POST['message']));
    
    $to = "info@gllogistics.org";
    $subject = "Price request from GL Logistics website";
    $headers = "From: no-reply@gllogistics.org\r\n";
    $headers .= "Reply-To: " . ($email ? $email : $to) . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    
    $body = "New price request:\n\n";
    $body .= "Name: $name\n";
    $body .= "Phone: $phone\n";
    $body .= "Email: " . ($email ? $email : "not provided") . "\n";
    $body .= "Message:\n$message\n";
    
    if (mail($to, $subject, $body, $headers)) {
        echo "success";
    } else {
        echo "error";
    }
} else {
    echo "error";
}
?>