# Minimal Dovecot used only by the integration / e2e tests.
base_dir = __ROOT__/run
state_dir = __ROOT__/state
log_path = __ROOT__/dovecot.log
protocols = imap
listen = 127.0.0.1
mail_location = maildir:__ROOT__/mail/%u
# inotify is unreliable in containers; poll often so IDLE pushes arrive promptly in tests.
mailbox_idle_check_interval = 1 secs
mail_uid = __UID__
mail_gid = __GID__
first_valid_uid = 1
auth_mechanisms = plain login
disable_plaintext_auth = no
ssl = yes
ssl_cert = <__ROOT__/cert.pem
ssl_key = <__ROOT__/key.pem
default_login_user = dovenull
default_internal_user = dovecot
passdb {
  driver = passwd-file
  args = scheme=PLAIN username_format=%u __ROOT__/users.passwd
}
userdb {
  driver = static
  args = uid=__UID__ gid=__GID__ home=__ROOT__/home/%u
}
namespace inbox {
  inbox = yes
  separator = /
  mailbox Drafts {
    special_use = \Drafts
    auto = subscribe
  }
  mailbox Sent {
    special_use = \Sent
    auto = subscribe
  }
  mailbox Trash {
    special_use = \Trash
    auto = subscribe
  }
  mailbox Junk {
    special_use = \Junk
    auto = subscribe
  }
  mailbox Archive {
    special_use = \Archive
    auto = subscribe
  }
}
service imap-login {
  inet_listener imap {
    port = __IMAP_PORT__
  }
  inet_listener imaps {
    port = __IMAPS_PORT__
    ssl = yes
  }
}
service anvil {
  chroot =
}
service imap-login {
  chroot =
}
protocol imap {
  imap_idle_notify_interval = 1 secs
}
