using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Nefarius.ViGEm.Client;
using Nefarius.ViGEm.Client.Targets;
using Nefarius.ViGEm.Client.Targets.Xbox360;

internal static class Program
{
    static async Task<int> Main(string[] args)
    {
        // Server: read commands from STDIN, one per line.
        // Commands:
        //   down <key>        e.g.  down S
        //   up <key>          e.g.  up S
        //   tap <key> <ms>    e.g.  tap J 60
        //   chord <k1,k2,..> <ms>   e.g. chord S,D,J 70
        //
        // Keys accepted (case-insensitive): W A S D J K M COMMA  B  V
        // Mapping:
        //   W->DPadUp, A->DPadLeft, S->DPadDown, D->DPadRight
        //   J->X (Square), K->Y (Triangle), M->A (Cross), COMMA->B (Circle)
        //   B->Start/Options, V->Back/Select

        using var client = new ViGEmClient();
        IXbox360Controller pad = client.CreateXbox360Controller();
        pad.Connect();

        var state = new PadState();
        Submit(pad, state); // neutral report

        using var reader = new StreamReader(Console.OpenStandardInput());
        for (;;)
        {
            var line = await reader.ReadLineAsync();
            if (line is null) break;
            line = line.Trim();
            if (line.Length == 0) continue;

            var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var cmd = parts[0].ToLowerInvariant();

            try
            {
                switch (cmd)
                {
                    case "down":
                        if (parts.Length >= 2 && TryApplyKey(parts[1], true, state))
                            Submit(pad, state);
                        break;

                    case "up":
                        if (parts.Length >= 2 && TryApplyKey(parts[1], false, state))
                            Submit(pad, state);
                        break;

                    case "tap":
                        if (parts.Length >= 3)
                        {
                            var key = parts[1];
                            var ms  = ParseInt(parts[2], 40);
                            if (TryApplyKey(key, true, state)) Submit(pad, state);
                            await Task.Delay(ms);
                            if (TryApplyKey(key, false, state)) Submit(pad, state);
                        }
                        break;

                    case "chord":
                        // chord S,D,J 60  → press S+D+J together for 60ms
                        if (parts.Length >= 3)
                        {
                            var keys = parts[1].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                            var ms = ParseInt(parts[2], 50);
                            bool changed = false;
                            foreach (var k in keys) changed |= TryApplyKey(k, true, state);
                            if (changed) Submit(pad, state);
                            await Task.Delay(ms);
                            changed = false;
                            foreach (var k in keys) changed |= TryApplyKey(k, false, state);
                            if (changed) Submit(pad, state);
                        }
                        break;

                    default:
                        // ignore unknown commands to keep server alive
                        break;
                }
            }
            catch
            {
                // swallow per-command errors; keep serving
            }
        }

        return 0;
    }

    static int ParseInt(string s, int def) =>
        int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : def;

    sealed class PadState
    {
        public bool Up, Down, Left, Right;
        public bool A, B, X, Y;
        public bool Start, Back;
    }

    static void Submit(IXbox360Controller pad, PadState s)
    {
        // Face/utility buttons
        pad.SetButtonState(Xbox360Button.A, s.A);
        pad.SetButtonState(Xbox360Button.B, s.B);
        pad.SetButtonState(Xbox360Button.X, s.X);
        pad.SetButtonState(Xbox360Button.Y, s.Y);
        pad.SetButtonState(Xbox360Button.Start, s.Start);
        pad.SetButtonState(Xbox360Button.Back, s.Back);

        // D-Pad bits (use buttons directly; no extension helpers required)
        pad.SetButtonState(Xbox360Button.Up, s.Up);
        pad.SetButtonState(Xbox360Button.Down, s.Down);
        pad.SetButtonState(Xbox360Button.Left, s.Left);
        pad.SetButtonState(Xbox360Button.Right, s.Right);

        pad.SubmitReport();
    }

    static bool TryApplyKey(string key, bool pressed, PadState s)
    {
        key = key.ToUpperInvariant();
        if (key == ",") key = "COMMA";

        switch (key)
        {
            case "W":      if (s.Up    != pressed) { s.Up    = pressed; return true; } break;
            case "A":      if (s.Left  != pressed) { s.Left  = pressed; return true; } break;
            case "S":      if (s.Down  != pressed) { s.Down  = pressed; return true; } break;
            case "D":      if (s.Right != pressed) { s.Right = pressed; return true; } break;

            case "J":      if (s.X     != pressed) { s.X     = pressed; return true; } break; // Square
            case "K":      if (s.Y     != pressed) { s.Y     = pressed; return true; } break; // Triangle
            case "M":      if (s.A     != pressed) { s.A     = pressed; return true; } break; // Cross
            case "COMMA":  if (s.B     != pressed) { s.B     = pressed; return true; } break; // Circle

            case "B":      if (s.Start != pressed) { s.Start = pressed; return true; } break; // Options
            case "V":      if (s.Back  != pressed) { s.Back  = pressed; return true; } break; // Select
        }
        return false;
    }
}
