// overlay-electron/tools/win/FpXRec/Program.cs
using System;
using System.Runtime.InteropServices;
using System.Threading;

// Simple XInput poller -> stdout lines: "down <KEY>" / "up <KEY>"
// Canonical keys:
//  DPad: Up=W, Down=S, Left=A, Right=D
//  Face: X=J(1), Y=K(2), A=M(3), B=COMMA(4)
//  Start=B (Options), Back=V (Select)
// Axis fallback: left stick used as DPad if no DPad bits observed.

internal static class Program
{
    // XInput P/Invoke
    [StructLayout(LayoutKind.Sequential)]
    struct XINPUT_GAMEPAD
    {
        public ushort wButtons;
        public byte   bLeftTrigger;
        public byte   bRightTrigger;
        public short  sThumbLX;
        public short  sThumbLY;
        public short  sThumbRX;
        public short  sThumbRY;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct XINPUT_STATE
    {
        public uint dwPacketNumber;
        public XINPUT_GAMEPAD Gamepad;
    }

    delegate uint XInputGetStateDelegate(uint dwUserIndex, out XINPUT_STATE pState);

    static XInputGetStateDelegate? LoadXInput()
    {
        foreach (var name in new[] { "xinput1_4.dll", "xinput1_3.dll", "xinput9_1_0.dll" })
        {
            var h = LoadLibrary(name);
            if (h != IntPtr.Zero)
            {
                var p = GetProcAddress(h, "XInputGetState");
                if (p != IntPtr.Zero)
                    return Marshal.GetDelegateForFunctionPointer<XInputGetStateDelegate>(p);
            }
        }
        return null;
    }

    const int XINPUT_GAMEPAD_DPAD_UP    = 0x0001;
    const int XINPUT_GAMEPAD_DPAD_DOWN  = 0x0002;
    const int XINPUT_GAMEPAD_DPAD_LEFT  = 0x0004;
    const int XINPUT_GAMEPAD_DPAD_RIGHT = 0x0008;
    const int XINPUT_GAMEPAD_START      = 0x0010;
    const int XINPUT_GAMEPAD_BACK       = 0x0020;
    const int XINPUT_GAMEPAD_A          = 0x1000;
    const int XINPUT_GAMEPAD_B          = 0x2000;
    const int XINPUT_GAMEPAD_X          = 0x4000;
    const int XINPUT_GAMEPAD_Y          = 0x8000;

    static void Emit(string type, string key)
    {
        Console.Write(type);
        Console.Write(' ');
        Console.WriteLine(key);
        Console.Out.Flush();
    }

    static int Main(string[] args)
    {
        int index = 0;
        int hz = 120;
        bool axisFallback = true;

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--index" && i+1 < args.Length) int.TryParse(args[++i], out index);
            else if (args[i] == "--hz" && i+1 < args.Length) int.TryParse(args[++i], out hz);
            else if (args[i] == "--axisFallback" && i+1 < args.Length) axisFallback = args[++i].ToLowerInvariant() != "false";
        }
        if (hz < 10) hz = 10; if (hz > 240) hz = 240;
        int interval = (int)Math.Round(1000.0 / hz);

        var xi = LoadXInput();
        if (xi is null) return 2;

        var haveDpadEver = false;
        var prev = new State();

        while (true)
        {
            // FIX: cast index (int) to uint for XInputGetState
            if (xi((uint)index, out var s) != 0)
            {
                // controller missing; clear state
                if (prev.valid)
                {
                    foreach (var k in prev.Keys())
                        if (prev[k]) Emit("up", k);
                }
                prev = new State();
                Thread.Sleep(200);
                continue;
            }

            var gp = s.Gamepad;
            var cur = new State();

            // DPad
            cur["W"] = (gp.wButtons & XINPUT_GAMEPAD_DPAD_UP)    != 0;
            cur["S"] = (gp.wButtons & XINPUT_GAMEPAD_DPAD_DOWN)  != 0;
            cur["A"] = (gp.wButtons & XINPUT_GAMEPAD_DPAD_LEFT)  != 0;
            cur["D"] = (gp.wButtons & XINPUT_GAMEPAD_DPAD_RIGHT) != 0;
            if (cur["W"] || cur["S"] || cur["A"] || cur["D"]) haveDpadEver = true;

            // Face buttons → canonical
            cur["J"] = (gp.wButtons & XINPUT_GAMEPAD_X) != 0;       // 1
            cur["K"] = (gp.wButtons & XINPUT_GAMEPAD_Y) != 0;       // 2
            cur["M"] = (gp.wButtons & XINPUT_GAMEPAD_A) != 0;       // 3
            cur["COMMA"] = (gp.wButtons & XINPUT_GAMEPAD_B) != 0;   // 4

            // Options/Select
            cur["B"] = (gp.wButtons & XINPUT_GAMEPAD_START) != 0;
            cur["V"] = (gp.wButtons & XINPUT_GAMEPAD_BACK)  != 0;

            // Axis fallback to DPad if none observed
            if (axisFallback && !haveDpadEver)
            {
                const int DEAD = 10000; // ~30%
                bool up    = gp.sThumbLY >  DEAD;
                bool down  = gp.sThumbLY < -DEAD;
                bool left  = gp.sThumbLX < -DEAD;
                bool right = gp.sThumbLX >  DEAD;
                cur["W"] |= up; cur["S"] |= down; cur["A"] |= left; cur["D"] |= right;
            }

            if (!prev.valid)
            {
                prev = cur;
                foreach (var k in cur.Keys()) if (cur[k]) Emit("down", k);
            }
            else
            {
                foreach (var k in cur.Keys())
                {
                    if (cur[k] != prev[k]) Emit(cur[k] ? "down" : "up", k);
                }
                prev = cur;
            }

            Thread.Sleep(interval);
        }
    }

    sealed class State
    {
        public bool valid = false;
        bool W,S,A,D,J,K,M,COMMA,B,V;
        public bool this[string k]
        {
            get => k switch {
                "W"=>W,"S"=>S,"A"=>A,"D"=>D,"J"=>J,"K"=>K,"M"=>M,"COMMA"=>COMMA,"B"=>B,"V"=>V,_=>false};
            set { valid = true; switch(k){
                case "W":W=value;break; case "S":S=value;break; case "A":A=value;break; case "D":D=value;break;
                case "J":J=value;break; case "K":K=value;break; case "M":M=value;break; case "COMMA":COMMA=value;break;
                case "B":B=value;break; case "V":V=value;break; } }
        }
        public string[] Keys() => new[]{"W","S","A","D","J","K","M","COMMA","B","V"};
    }

    [DllImport("kernel32.dll", SetLastError=true)]
    static extern IntPtr LoadLibrary(string lpFileName);

    [DllImport("kernel32.dll", SetLastError=true)]
    static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName);
}
