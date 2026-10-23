# CloudStack and host network review — NOT APPLIED

Review date: October 22, 2026. Scope: owner-confirmed isolated `koonpinai-staging` only. No firewall, SSH, security-group, NAT or network setting was changed. PostgreSQL must remain private.

## Confirmed host observations

- Fresh SSH checks matched the previously recorded hashed VM identity. Ubuntu26.04, Docker29.9.2 and Compose5.6.1 remain available.
- UFW is **inactive**, as it was before Docker installation. An enabled systemd unit is not evidence of active packet filtering.
- Only SSH22 listens on non-loopback IPv4/IPv6 addresses after test teardown. No5432, application, health or Docker TCP listener was found.
- `sshd -T` reports public-key authentication enabled, password authentication enabled, keyboard-interactive disabled, empty passwords disabled and root login limited to keys. This does not establish that any account has a usable password or that SSH is publicly reachable.
- Docker's only remaining networks are its default bridge/host/none. No rehearsal containers remain. The five unattributed anonymous volumes were preserved.
- The reviewed Compose contract uses an internal database network, **no PostgreSQL port publication**, verified database TLS and loopback-only web publication. An internal bridge is not a substitute for checking host/edge rules.

Evidence: private `release-host-audit.json`, `release-host-listeners.txt`, `release-iptables.txt`, `release-nft.txt`, `release-additional-audit.json` and the final release audit in the retained staging execution directory. No public IP addresses or SSH account names are needed in the PR.

The final audit succeeded at2026-10-22T16:18:34Z. Later evidence-copy and SSH attempts timed out before authentication. Current management reachability is therefore pending recheck; the timeout alone does not identify whether VM state, VPN, routing or edge filtering is responsible. Do not change rules speculatively to restore access.

## October23 SSH investigation

Fresh checks from Windows at17:23:25–17:23:49 UTC October22 (00:23 Bangkok October23): three independent SSH attempts, each bounded to8 seconds, all timed out before TCP establishment, server banner or authentication. Direct TCP22 and5432 probes also timed out. The alias resolves directly to its configured private IPv4 address with no ProxyJump/ProxyCommand; DNS is not in this path.

Windows has an active OpenVPN TAP interface and a specific10.60.0.0/22 route through its VPN next hop. Traceroute reaches that next hop (about34–35ms), then receives no replies. Ping receives no replies. ICMP silence does not establish where TCP is dropped, and an Up VPN adapter/route does not prove tunnel health. No Windows route, VPN, SSH config or firewall was changed.

The retained **post-installation** iptables/nftables snapshots show INPUT ACCEPT, Docker-managed FORWARD DROP/chains and172.17.0.0/16 bridge masquerading, with no remaining port DNAT. Pre-installation rulesets were empty, UFW was inactive, and the successful post-install audit verified11 original non-Docker routes unchanged. The bridge range in that snapshot does not overlap the observed10.60 management network. Docker documents its [forwarding-policy changes](https://docs.docker.com/engine/network/packet-filtering-firewalls/). A forwarding drop can matter if a host acts as a router; it does not by itself explain a connection terminating at the host's SSH INPUT path. This is an inference from **historical** rules, not proof of the current VM state or evidence clearing every possible Docker interaction.

Current SSH daemon/listener, CPU/RAM/disk, rules and packet arrival cannot be rechecked remotely while TCP is unavailable. No restart, firewall reset, Docker shutdown or CloudStack change is justified by these observations alone. Port5432 is unpublished by Compose and was absent at the last successful host audit; today's private-path timeout is **not proof of current public non-exposure**. CloudStack edge/IPv6 rules remain unverified.

### Exact read-only VM-console commands

Open CloudStack **Compute → Instances → staging VM → View Console** and confirm its state is Running. Run the following on that VM, not a router or production instance. They do not restart services, change rules or inspect credential-bearing container environments. Keep journals private; report sanitized status/errors/timestamps rather than usernames or full authentication logs.

```bash
date -u
uptime
free -h
df -h /
df -i /
systemctl is-active ssh ssh.socket docker containerd
sudo systemctl --no-pager --full status ssh ssh.socket
sudo /usr/sbin/sshd -t
sudo ss -lntp '( sport = :22 or sport = :5432 )'
ip -br address
ip -4 route show table all
ip -6 route show table all
ip rule show
ip neigh show
sudo ufw status verbose
sudo iptables-save
sudo ip6tables-save
sudo nft list ruleset
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding net.ipv4.conf.all.rp_filter net.ipv4.conf.default.rp_filter
sudo timeout 15 docker ps -a --format '{{.Names}} {{.Status}} {{.Ports}}'
sudo timeout 15 docker network ls
sudo journalctl -u ssh -u ssh.socket --since '2 hours ago' --no-pager -n 80
sudo journalctl -u docker --since '2 hours ago' --no-pager -n 50
sudo journalctl -k --since '2 hours ago' --no-pager -g 'oom|Out of memory|Killed process|nf_conntrack.*full|link.*down|virtio'
```

`sshd -t` succeeds silently when valid. A socket-activated `ssh.service` may be inactive before a connection while `ssh.socket` is active; interpret both with listener status. Docker-command timeouts are evidence of an unresponsive daemon, not permission to restart it. Missing optional commands should be reported, not installed automatically.

If `tcpdump` is already present, run this bounded header-only capture in the VM console while retrying SSH from Windows. Do not install it without approval:

```bash
if command -v tcpdump >/dev/null 2>&1; then
  sudo timeout 25 tcpdump -nni any -c 12 -s 80 'tcp port 22 and (tcp[tcpflags] & tcp-syn != 0)'
fi
```

- No SYN reaches the VM during a known retry: investigate VPN, routing and CloudStack controls first; this does not identify a particular upstream device.
- SYN arrives but no SYN-ACK leaves: compare current listener, address/routes, reverse-path filtering and rule counters; check local resource pressure. Do not broaden rules speculatively.
- SYN/SYN-ACK appear but the client never connects: investigate return-path/NAT/filtering. A later authentication failure is a different layer and must not be diagnosed as today's pre-TCP timeout.

The saved original routing inventory is `/var/tmp/koonpinai-staging-20261022-44b0370b8b/routes-before.txt` and original configuration archive is `config-etc_ufw.tar` in that directory. Compare without extracting over `/etc` or restoring anything. The previous `final-host-audit.json` recorded unchanged original routes/UFW files; it is not a live check. Compare only non-Docker physical/local routes in the same IPv4/IPv6/all-table scope, and inspect any currently active Docker network subnets for overlap before proposing a fix.

After connectivity returns, acceptance requires repeated bounded key-based connections over time (at least five checks spanning two minutes), unchanged identity, stable SSH/listener/resources, no unexpected routes/rules and no5432 publication. Rerun after any separately approved corrective action. **Ongoing staging operational status is NO-GO until this succeeds.**

## October 23 restored-access comparison

The owner subsequently repaired connectivity. Read-only checks at 06:43–06:52 UTC matched the saved hashed VM identity. The dedicated acceptance window used five independent connections with public-key-only authentication, strict host-key checking and SSH multiplexing disabled. All passed between 06:50:09 and 06:52:38 UTC, spanning 147 seconds between starts, with active SSH/Docker/containerd and successful `sshd -t` on every probe. One earlier bounded attempt exited 255 after about 10.6 seconds before identity/service output; its failure layer was not preserved. Default and strict retries immediately succeeded. The five-check window passes the management criterion above; continued uptime is not established by a short window.

| Saved baseline comparison | Current observation |
| --- | --- |
| Physical/local routes | All 11 IPv4/IPv6/all-table routes match after excluding Docker interfaces; same management address/subnet/default gateway |
| UFW | Still inactive; every regular file in the saved UFW archive matches current bytes |
| IPv4 firewall | After ignoring counters/comments, only the previously empty raw table with ACCEPT PREROUTING/OUTPUT chains is absent. Filter/NAT rules and policies match. This removes no filtering rule |
| IPv6 firewall | Rules match after ignoring counters/comments |
| Forwarding | IPv4 forwarding remains enabled and IPv6 forwarding disabled, matching the post-Docker baseline |
| SSH effective settings | Recorded password/key/root-login/keyboard-interactive/forwarding/X11 settings match the earlier release audit. Existing config-file timestamps predate this fix; timestamps are not a historical byte comparison |
| Netplan and DNS | Netplan was rewritten at 05:47:58 UTC; current static settings produce the same routes and use an internal DNS resolver. Original netplan/DNS bytes were not saved, so those configuration edits cannot be fully compared |
| Boot and capacity | Current boot began 05:15:43 UTC. About 7.8 GiB RAM is visible versus about 3.8 GiB at installation; 2 CPUs remain. The cause/relationship to the SSH fix is not independently established |
| Exposure | Only SSH listens outside loopback; no 5432, application, health or Docker TCP listener. Zero containers, default Docker networks and the same five preserved volumes. No global IPv6 address |

No observed host-policy difference broadens access. UFW inactivity, SSH password authentication, key-only root login and SSH forwarding/X11 were already recorded before the fix. The absence of empty raw chains has no filtering effect; its cause is unproven. No original netplan snapshot, CloudStack rule export or owner change journal is available to attribute every manual change. CloudStack public IP/NAT/security-group/ACL/IPv6 controls remain unaudited. Host-side absence of PostgreSQL listeners/publication is verified; independent public-edge non-exposure is not established.

Docker29.9.2, Compose5.6.1 and containerd are healthy, no systemd units are failed, and the same Compose-file SHA256 passes `config --quiet` using placeholders without secret loading or service startup. The application stack was deliberately cleaned up after successful synthetic rehearsals. Both sealed images and Linux/Windows archive hashes are intact. Nine previously pending release evidence files were copied privately and matched VM SHA256 values. Historical failures were preserved alongside the later PASS results.

No networking, firewall, SSH configuration or service was changed during this verification. Keep the manual fix in place. Public staging/production exposure and any hardening remain subject to the separate CloudStack review and explicit approval below.
## Manual CloudStack Dashboard checklist

The owner has no read-only API connection/export. These edge controls are **unverified**. Labels vary with CloudStack version and network offering. Record screenshots/exports privately; redact IPs where appropriate.

1. **Compute → Instances → staging instance → NICs:** identify every NIC, network, VPC/tier, attached security group, IPv4 and IPv6 assignment. Confirm this is the isolated staging VM.
2. **Network → Networks → each attached guest network:** identify Basic/Advanced/shared/isolated networking, security-group support and the associated network offering. Inspect every applicable network, not just the default NIC.
3. **Network → Public IP Addresses** (or the network's **Public IP Addresses** tab): for **every IP associated with the network/VM**, inspect **Firewall**, **Port Forwarding**, **Static NAT** and **Load Balancing**. Source NAT alone is not an inbound forwarding rule. Static NAT and broad port ranges need explicit review.
4. If security groups apply: **Network → Security Groups → every group attached to the instance → Ingress/Egress**. Multiple groups can broaden effective access. Check inherited/shared rules too.
5. If this is a VPC: **Network → VPC → tier/network → ACL association**, then the associated **Network ACL List**. Check direction, order, CIDRs and the default action.
6. For SSH22, verify ingress is limited to the operator-approved administration/VPN CIDRs. The actual CIDRs must come from the owner/network administrator. Review both `0.0.0.0/0` and `::/0`; do not remove working SSH until alternate access is verified.
7. Verify **no public forwarding, static-NAT permission, load-balancer listener or broad range exposes5432**, application3000, health3001, rehearsal3331 or55434–55534, or Docker2375/2376. Review IPv6 independently; lack of an IPv4 NAT rule does not settle IPv6 exposure.
8. Keep80/443 closed to public staging access for now. Future HTTPS proxy/callback exposure is a separate approved change, with a canonical hostname, certificate and private backend/health path.
9. Review egress requirements without adding blanket rules: approved DNS resolver53, HTTPS443 to KMITL SSO and approved registries during builds, and the provider's time service where required. No offsite destination is approved, so no backup egress rule is requested.
10. Record the effective rule sets, associated object IDs, reviewer and timestamp. Confirm SSH access from an approved source and absence of unwanted access from an independently authorized test host. A host listener inventory alone cannot prove edge filtering.

CloudStack documents these conditional [firewall/forwarding controls](https://docs.cloudstack.apache.org/en/latest/adminguide/networking/ip_forwarding_and_firewalling.html). Docker documents why [published container ports require separate firewall consideration](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

## Proposed host hardening — separate approval required

- Establish an out-of-band console and verify two independent key-based SSH sessions before any rule or sshd change.
- Prepare a narrow host allowlist for the approved management CIDRs and established traffic. Validate and stage a timed recovery path before enabling filtering. Do not enable UFW blindly or assume it covers Docker-published ports.
- After key access/recovery is proven, propose disabling password authentication and unnecessary SSH forwarding/X11 features. Review VS Code dependencies first; do not interrupt the owner's existing remote processes.
- Keep Docker's packet filtering enabled; do not use privileged containers, host networking or a remotely exposed Docker socket. Preserve loopback publication and the internal database bridge.
- No command in this document authorizes applying these changes. Public exposure remains blocked pending the edge review and a separately approved implementation.
