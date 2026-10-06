import argparse
import json
import sys
import threading
import socket
from pymodbus.client import ModbusSerialClient
from pymodbus.exceptions import ModbusException
import serial.tools.list_ports
import re
import os
if os.name == 'nt':
    try:
        import ctypes
        import serial
        import serial.serialwin32 as _win32
        _orig_reconfigure = _win32.Serial._reconfigure_port

        def _safe_reconfigure_port(self):
            if not self._port_handle:
                raise serial.SerialException('Can only operate on a valid port handle')

            timeouts = _win32.win32.COMMTIMEOUTS()
            if self._timeout is None:
                pass
            elif self._timeout == 0:
                timeouts.ReadIntervalTimeout = _win32.win32.MAXDWORD
            else:
                timeouts.ReadTotalTimeoutConstant = max(int(self._timeout * 1000), 1)
            if self._timeout != 0 and self._inter_byte_timeout is not None:
                timeouts.ReadIntervalTimeout = max(int(self._inter_byte_timeout * 1000), 1)

            timeouts.WriteTotalTimeoutConstant = 2000
            timeouts.WriteTotalTimeoutMultiplier = 0

            _win32.win32.SetCommTimeouts(self._port_handle, ctypes.byref(timeouts))
            _win32.win32.SetCommMask(self._port_handle, _win32.win32.EV_ERR)

            comDCB = _win32.win32.DCB()
            _win32.win32.GetCommState(self._port_handle, ctypes.byref(comDCB))
            comDCB.BaudRate = self._baudrate
            comDCB.ByteSize = 8
            comDCB.Parity = _win32.win32.NOPARITY
            comDCB.StopBits = _win32.win32.TWOSTOPBITS if self._stopbits == serial.STOPBITS_TWO else _win32.win32.ONESTOPBIT
            comDCB.fBinary = 1
            
            # Try SetCommState, ignore Error 31 (Windows CH340 driver bug)
            if not _win32.win32.SetCommState(self._port_handle, ctypes.byref(comDCB)):
                err = ctypes.GetLastError()
                if err != 31:
                    raise serial.SerialException(f'Cannot configure port: Error {err}')

        _win32.Serial._reconfigure_port = _safe_reconfigure_port
    except Exception:
        pass

def setup_client(args):
    parity_map = {'N': 'N', 'E': 'E', 'O': 'O'}
    return ModbusSerialClient(
        port=args.port,
        baudrate=args.baud,
        parity=parity_map.get(args.parity, 'N'),
        stopbits=args.stopbits,
        timeout=args.timeout,
        retries=0
    )

def handle_response(response, count=None):
    if response.isError():
        return {"success": False, "error": f"Modbus Exception: {response}"}
    
    if hasattr(response, 'registers'):
        data = response.registers
        if count and len(data) != count:
            return {"success": False, "error": f"Expected {count} registers, got {len(data)}"}
        return {"success": True, "data": data}
        
    if hasattr(response, 'bits'):
        data = response.bits[:count] if count else response.bits
        return {"success": True, "data": data}
        
    return {"success": True, "data": "Operation successful"}

def read_input(client, args):
    try:
        response = client.read_input_registers(address=args.addr, count=args.count, device_id=args.slave)
        return handle_response(response, args.count)
    except Exception as e:
        return {"success": False, "error": str(e)}

import traceback

def read_holding(client, args):
    try:
        response = client.read_holding_registers(address=args.addr, count=args.count, device_id=args.slave)
        return handle_response(response, args.count)
    except Exception as e:
        return {"success": False, "error": str(e) + " Traceback: " + traceback.format_exc()}

def read_coil(client, args):
    try:
        response = client.read_coils(address=args.addr, count=args.count, device_id=args.slave)
        return handle_response(response, args.count)
    except Exception as e:
        return {"success": False, "error": str(e)}

def read_discrete(client, args):
    try:
        response = client.read_discrete_inputs(address=args.addr, count=args.count, device_id=args.slave)
        return handle_response(response, args.count)
    except Exception as e:
        return {"success": False, "error": str(e)}

def write_register(client, args):
    try:
        response = client.write_register(address=args.addr, value=args.value, device_id=args.slave)
        return handle_response(response)
    except Exception as e:
        return {"success": False, "error": str(e)}

def write_coil(client, args):
    try:
        response = client.write_coil(address=args.addr, value=args.value, device_id=args.slave)
        return handle_response(response)
    except Exception as e:
        return {"success": False, "error": str(e)}

def write_registers(client, args):
    try:
        values = [int(v) for v in args.values.split(',')]
        response = client.write_registers(address=args.addr, values=values, device_id=args.slave)
        return handle_response(response)
    except Exception as e:
        return {"success": False, "error": str(e)}
        
def test_connection(client, args):
    try:
        # PV is usually at input register 1000 (301001)
        response = client.read_input_registers(address=1000, count=1, device_id=args.slave)
        return handle_response(response, 1)
    except Exception as e:
        return {"success": False, "error": str(e)}

def toggle_pin(client, args):
    import time
    try:
        channel = args.channel.upper()
        slave = args.slave
        # Set RUN to allow MV manipulation
        client.write_register(address=0, value=0, device_id=slave)

        if channel in ["OUT1", "OUT2", "PIN18_21", "18_21", "RUN_MV100"]:
            mv_reg = 3 if channel != "OUT2" else 4
            # Mode manual
            client.write_register(address=2, value=1, device_id=slave)
            # Set 100% MV (1000 = 100.0%)
            client.write_register(address=mv_reg, value=1000, device_id=slave)
            time.sleep(3)
            # Reset MV & set Auto mode
            client.write_register(address=mv_reg, value=0, device_id=slave)
            client.write_register(address=2, value=0, device_id=slave)
            return {"success": True, "message": "Pin 18–21 berhasil dihubungkan via Software Modbus! MV 100% aktif tanpa jumper fisik."}
        elif channel.startswith("AL"):
            idx = int(channel.replace("AL", ""))
            base = 451 + 8 * (idx - 1)  # REG_ALARM_MODE offset
            client.write_register(address=base, value=0x0005, device_id=slave)
            client.write_register(address=base + 2, value=100, device_id=slave) # Absolute high
            client.write_register(address=base + 7, value=idx, device_id=slave)
            time.sleep(2)
            # Reset alarm config
            client.write_register(address=base, value=0, device_id=slave)
            return {"success": True, "message": f"{channel} (Alarm {idx}) berhasil di-trigger aktif selama 2 detik."}
        else:
            return {"success": False, "error": f"Kanal {channel} tidak dikenal"}
    except Exception as e:
        return {"success": False, "error": f"Gagal trigger {args.channel}: {str(e)}"}

def list_ports(args=None):
    import serial.tools.list_ports
    import glob
    ports = list(serial.tools.list_ports.comports())
    existing_devs = {p.device for p in ports}

    if os.name != 'nt':
        for pattern in ['/dev/ttyUSB*', '/dev/ttyACM*', '/dev/ttyAMA*', '/dev/ttyS*', '/dev/tty.usbserial*', '/dev/cu.usbserial*', '/dev/tty.wch*', '/dev/cu.wch*', '/dev/tty.SLAB*']:
            for dev in glob.glob(pattern):
                if dev not in existing_devs:
                    class _P:
                        def __init__(self, d):
                            self.device = d
                            self.description = 'Serial Device (' + d + ')'
                            self.hwid = d
                            self.manufacturer = 'Generic'
                            self.serial_number = None
                            self.location = d
                    ports.append(_P(dev))
                    existing_devs.add(dev)

    return {
        "success": True,
        "ports": [
            {
                "device": p.device,
                "description": p.description,
                "hwid": getattr(p, 'hwid', p.device),
                "manufacturer": getattr(p, 'manufacturer', 'Generic'),
                "serial_number": getattr(p, 'serial_number', None),
                "location": getattr(p, 'location', p.device),
            }
            for p in ports
        ]
    }

def scan_ports(client, args):
    import serial.tools.list_ports

    def port_sort_key(port_info):
        desc = (port_info.description or "").lower()
        dev = port_info.device.lower()
        if "ch340" in desc or "ch341" in desc or "ftdi" in desc or "cp210" in desc or "prolific" in desc or "usb-serial" in desc or "rs485" in desc:
            return (0, dev)
        if "usb" in desc or "usb" in dev:
            return (1, dev)
        return (2, dev)

    ports = sorted(serial.tools.list_ports.comports(), key=port_sort_key)
    found = []
    for port in ports:
        args.port = port.device
        test_client = setup_client(args)
        if test_client.connect():
            try:
                response = test_client.read_input_registers(address=1000, count=1, device_id=args.slave)
                if not response.isError():
                    return {"success": True, "port": port.device}
            except Exception:
                pass
            finally:
                test_client.close()
    return {"success": False, "error": "No working Modbus port found", "ports_tried": [p.device for p in ports]}

def read_all(client, args):
    slaves = [int(s.strip()) for s in args.slaves.split(',') if s.strip()]
    results = {}
    for slave_id in slaves:
        try:
            if hasattr(client, 'socket') and client.socket and getattr(client.socket, 'is_open', False):
                try:
                    client.socket.reset_input_buffer()
                    client.socket.reset_output_buffer()
                except Exception:
                    pass
            response = client.read_input_registers(address=args.addr, count=args.count, device_id=slave_id)
            if response.isError():
                results[slave_id] = {"success": False, "error": f"Modbus Exception: {response}"}
            else:
                results[slave_id] = {"success": True, "data": response.registers}
        except Exception as e:
            results[slave_id] = {"success": False, "error": str(e)}
    return {"success": True, "controllers": results}

HANDLERS = {
    "read_input": read_input,
    "read_holding": read_holding,
    "read_coil": read_coil,
    "read_discrete": read_discrete,
    "write_register": write_register,
    "write_coil": write_coil,
    "write_registers": write_registers,
    "test_connection": test_connection,
    "toggle_pin": toggle_pin
}

class CommandArgs:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
        if not hasattr(self, 'slave'): self.slave = 1
        if not hasattr(self, 'addr'): self.addr = 0
        if not hasattr(self, 'count'): self.count = 1
        if not hasattr(self, 'value'): self.value = 0
        if not hasattr(self, 'values'): self.values = ''
        if not hasattr(self, 'channel'): self.channel = ''

def execute_modbus_req(client, req, lock):
    cmd = req.get("command")
    if cmd == "ping":
        return {"pong": True, "success": True}

    with lock:
        if cmd == "read_all":
            slaves = req.get("slaves", [1])
            addr = req.get("addr", 1000)
            count = req.get("count", 27)
            results = {}
            for slave_id in slaves:
                try:
                    if hasattr(client, 'socket') and client.socket and getattr(client.socket, 'is_open', False):
                        try:
                            client.socket.reset_input_buffer()
                            client.socket.reset_output_buffer()
                        except Exception:
                            pass
                    response = client.read_input_registers(address=addr, count=count, device_id=slave_id)
                    if response.isError():
                        results[slave_id] = {"success": False, "error": f"Modbus Exception: {response}"}
                    else:
                        results[slave_id] = {"success": True, "data": response.registers}
                except Exception as e:
                    results[slave_id] = {"success": False, "error": str(e)}
            return {"success": True, "controllers": results}

        elif cmd in HANDLERS:
            try:
                args_obj = CommandArgs(**req)
                if cmd == 'write_coil':
                    args_obj.value = bool(args_obj.value)
                return HANDLERS[cmd](client, args_obj)
            except Exception as e:
                return {"success": False, "error": str(e)}
        else:
            return {"success": False, "error": f"Unknown command {cmd}"}

def start_tcp_listener(client, lock, port=5029):
    def listener_thread():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('127.0.0.1', port))
            sock.listen(10)
            while True:
                conn, _ = sock.accept()
                def handle_conn(c):
                    try:
                        f = c.makefile('r', encoding='utf-8')
                        for line in f:
                            raw = line.strip()
                            if not raw:
                                continue
                            try:
                                r = json.loads(raw)
                                res = execute_modbus_req(client, r, lock)
                                c.sendall((json.dumps(res) + "\n").encode('utf-8'))
                            except Exception as ex:
                                c.sendall((json.dumps({"success": False, "error": str(ex)}) + "\n").encode('utf-8'))
                    except Exception:
                        pass
                    finally:
                        c.close()
                t = threading.Thread(target=handle_conn, args=(conn,))
                t.daemon = True
                t.start()
        except Exception as e:
            sys.stderr.write(f"TCP listener error on port {port}: {e}\n")
            sys.stderr.flush()

    tcp_thread = threading.Thread(target=listener_thread)
    tcp_thread.daemon = True
    tcp_thread.start()

def run_worker(client, args):
    """
    Persistent line-based JSON-RPC worker via stdin/stdout and loopback TCP 127.0.0.1:5029.
    Keeps the serial port open continuously for ultra-low latency (<130ms) Modbus communication.
    """
    lock = threading.Lock()
    tcp_port = getattr(args, 'tcp_port', 5029) or 5029
    start_tcp_listener(client, lock, tcp_port)

    sys.stdout.write(json.dumps({"ready": True, "tcp_port": tcp_port}) + "\n")
    sys.stdout.flush()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            if req.get("command") == "exit":
                sys.stdout.write(json.dumps({"success": True}) + "\n")
                sys.stdout.flush()
                break
            res = execute_modbus_req(client, req, lock)
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({"success": False, "error": str(e)}) + "\n")
            sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="Modbus Bridge for Laravel")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Common arguments
    parser.add_argument("--port", required=False, help="Serial port (e.g., COM3, /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=9600, help="Baudrate")
    parser.add_argument("--parity", default="N", help="Parity (N, E, O)")
    parser.add_argument("--stopbits", type=int, default=2, help="Stop bits")
    parser.add_argument("--timeout", type=float, default=1.0, help="Timeout in seconds")
    
    # read_input
    p_ri = subparsers.add_parser("read_input")
    p_ri.add_argument("--slave", type=int, required=True)
    p_ri.add_argument("--addr", type=int, required=True)
    p_ri.add_argument("--count", type=int, required=True)
    
    # read_holding
    p_rh = subparsers.add_parser("read_holding")
    p_rh.add_argument("--slave", type=int, required=True)
    p_rh.add_argument("--addr", type=int, required=True)
    p_rh.add_argument("--count", type=int, required=True)
    
    # read_coil
    p_rc = subparsers.add_parser("read_coil")
    p_rc.add_argument("--slave", type=int, required=True)
    p_rc.add_argument("--addr", type=int, required=True)
    p_rc.add_argument("--count", type=int, required=True)
    
    # read_discrete
    p_rd = subparsers.add_parser("read_discrete")
    p_rd.add_argument("--slave", type=int, required=True)
    p_rd.add_argument("--addr", type=int, required=True)
    p_rd.add_argument("--count", type=int, required=True)
    
    # write_register
    p_wr = subparsers.add_parser("write_register")
    p_wr.add_argument("--slave", type=int, required=True)
    p_wr.add_argument("--addr", type=int, required=True)
    p_wr.add_argument("--value", type=int, required=True)
    
    # write_coil
    p_wc = subparsers.add_parser("write_coil")
    p_wc.add_argument("--slave", type=int, required=True)
    p_wc.add_argument("--addr", type=int, required=True)
    p_wc.add_argument("--value", type=int, required=True) # Usually 0xFF00 (True) or 0x0000 (False) for coils, pymodbus handles bools, so 0 or 1
    
    # write_registers
    p_wrs = subparsers.add_parser("write_registers")
    p_wrs.add_argument("--slave", type=int, required=True)
    p_wrs.add_argument("--addr", type=int, required=True)
    p_wrs.add_argument("--values", required=True, help="Comma-separated values")
    
    # test_connection
    p_tc = subparsers.add_parser("test_connection")
    p_tc.add_argument("--slave", type=int, required=True)
    
    # toggle_pin
    p_tp = subparsers.add_parser("toggle_pin")
    p_tp.add_argument("--slave", type=int, required=True)
    p_tp.add_argument("--channel", required=True, help="Channel name e.g. OUT1, OUT2, AL1..AL6")
    
    # list_ports
    subparsers.add_parser("list_ports")

    # scan_ports
    p_sp = subparsers.add_parser("scan_ports")
    p_sp.add_argument("--slave", type=int, required=True)

    # read_all - batch read all controllers in one connection
    p_ra = subparsers.add_parser("read_all")
    p_ra.add_argument("--slaves", required=True, help="Comma-separated slave IDs")
    p_ra.add_argument("--addr", type=int, default=1000, help="Start address")
    p_ra.add_argument("--count", type=int, default=27, help="Register count")

    # worker - persistent JSON-RPC worker via stdin/stdout
    p_w = subparsers.add_parser("worker")
    p_w.add_argument("--tcp-port", type=int, default=5029, help="Loopback TCP port for external IPC")

    args = parser.parse_args()
    
    # pymodbus expects bool for write_coil value
    if args.command == 'write_coil':
        args.value = bool(args.value)

    if args.command == 'list_ports':
        result = list_ports(args)
        print(json.dumps(result))
        sys.exit(0)

    if args.command == 'scan_ports':
        result = scan_ports(None, args)
        print(json.dumps(result))
        sys.exit(0)

    if args.command == 'worker':
        if not args.port:
            print(json.dumps({"success": False, "error": "--port is required for worker"}))
            sys.exit(0)
        client = setup_client(args)
        if not client.connect():
            print(json.dumps({"success": False, "error": f"Could not connect to {args.port}"}))
            sys.exit(0)
        run_worker(client, args)
        client.close()
        sys.exit(0)

    if args.command == 'read_all':
        if not args.port:
            print(json.dumps({"success": False, "error": "--port is required for read_all"}))
            sys.exit(0)
        client = setup_client(args)
        if not client.connect():
            print(json.dumps({"success": False, "error": f"Could not connect to {args.port}"}))
            sys.exit(0)
        result = read_all(client, args)
        client.close()
        print(json.dumps(result))
        sys.exit(0)

    if not args.port:
        print(json.dumps({"success": False, "error": "--port is required for this command"}))
        sys.exit(0)

    client = setup_client(args)
    if not client.connect():
        print(json.dumps({"success": False, "error": f"Could not connect to {args.port}"}))
        sys.exit(0)
        
    result = HANDLERS[args.command](client, args)
    client.close()
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
