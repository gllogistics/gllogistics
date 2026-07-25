<?php
// ВАЖНО: если сайт хостится на Vercel (см. vercel.json), этот файл, скорее всего,
// НЕ будет выполняться — Vercel по умолчанию не запускает PHP без стороннего
// билдера (например, vercel-php). Сейчас форма на index.html отправляется через
// Formspree, а не сюда, так что этот файл, похоже, не используется.
// Если он вам всё же нужен (другой хостинг, cPanel и т.п.) — вот исправленная версия.

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name    = htmlspecialchars(trim($_POST['name'] ?? ''));
    $phone   = htmlspecialchars(trim($_POST['phone'] ?? ''));
    $emailRaw = trim($_POST['email'] ?? '');
    $message = htmlspecialchars(trim($_POST['message'] ?? ''));

    // ФИКС: раньше $email подставлялся в заголовок Reply-To без всякой проверки.
    // Если бы кто-то передал email со спрятанными переносами строк (\r\n),
    // он мог бы внедрить произвольные дополнительные заголовки письма
    // (email header injection) — например, добавить скрытые Bcc или подменить
    // тему письма. Теперь email обязательно проверяется filter_var(), и заодно
    // убираются любые случайно попавшие символы перевода строки.
    $email = '';
    if ($emailRaw !== '') {
        $emailCandidate = str_replace(["\r", "\n", "%0a", "%0d"], '', $emailRaw);
        if (filter_var($emailCandidate, FILTER_VALIDATE_EMAIL)) {
            $email = $emailCandidate;
        }
    }

    // На всякий случай не даём переносы строк попасть и в имя/телефон,
    // раз они когда-нибудь тоже окажутся в заголовках.
    $name  = str_replace(["\r", "\n"], ' ', $name);
    $phone = str_replace(["\r", "\n"], ' ', $phone);

    $to = "info@gllogistics.org";
    $subject = "Price request from GL Logistics website";
    $headers = "From: no-reply@gllogistics.org\r\n";
    $headers .= "Reply-To: " . ($email !== '' ? $email : $to) . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    $body = "New price request:\n\n";
    $body .= "Name: $name\n";
    $body .= "Phone: $phone\n";
    $body .= "Email: " . ($email !== '' ? $email : "not provided") . "\n";
    $body .= "Message:\n$message\n";

    if (mail($to, $subject, $body, $headers)) {
        echo "success";
    } else {
        echo "error";
    }
} else {
    echo "error";
}
