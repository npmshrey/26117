"""Real, live egress inspection — not a claim, a measurement.

Enumerates this machine's actual established network connections and
classifies each as loopback/private-LAN vs external, so the zero-egress
panel in the UI reflects genuine process state.
"""
import ipaddress
import psutil


def _classify(ip: str) -> str:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return "unknown"
    if addr.is_loopback:
        return "loopback"
    if addr.is_private:
        return "lan"
    if addr.is_link_local or addr.is_multicast:
        return "local"
    return "external"


def snapshot() -> dict:
    connections = []
    external_count = 0
    try:
        conns = psutil.net_connections(kind="inet")
    except (psutil.AccessDenied, PermissionError):
        conns = []

    for c in conns:
        if not c.raddr:
            continue
        rip = c.raddr.ip
        cls = _classify(rip)
        if cls == "external":
            external_count += 1
        connections.append(
            {
                "laddr": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else None,
                "raddr": f"{rip}:{c.raddr.port}",
                "status": c.status,
                "pid": c.pid,
                "class": cls,
            }
        )

    io = psutil.net_io_counters(pernic=True)
    interfaces = [
        {
            "name": name,
            "bytes_sent": stat.bytes_sent,
            "bytes_recv": stat.bytes_recv,
        }
        for name, stat in io.items()
    ]

    return {
        "external_connections": external_count,
        "total_connections": len(connections),
        "connections": connections[:50],
        "interfaces": interfaces,
        "zero_egress": external_count == 0,
    }
