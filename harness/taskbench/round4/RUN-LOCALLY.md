# Running round-4 mining locally

The remote container reaps detached background processes: the pilot was killed
outright twice — no exit status, no signal, ~14 seconds into a resumed run —
which is the supervision failure round 3.1 already recorded and `setsid` does not
fix. Mining is long-running and must outlive whoever started it, so it runs
better on a machine you control.

Nothing about the protocol changes. The ledger is committed, the walk is frozen,
and the miner resumes from repository-level verdicts, so a local run continues
exactly where the remote one stopped.

## Claude is not involved in mining

**No Claude Code, no model, no API key, no cost.** Mining is mechanical: it
clones repositories, applies the FRAME5 gates, finds historical regressions with
a known upstream fix, and validates that the suite fails before the fix and
passes after. `mine5.sh` says so at the top — *no agent runs happen here*.

The agent runs are a **later, separate phase**: once the pilot's tasks exist and
freeze 2 registers the treatment, each task is run twice (gated and ungated) by
a pinned Claude Code configuration. That phase needs Claude and an API budget.
This one needs a network connection and CPU.

## Docker (recommended)

The container is Linux, so the GNU tools the scripts need are already there and
nothing has to be installed on the Mac. The container is also its own
supervisor, which is the whole problem being solved.

```bash
git clone https://github.com/hamsasoftware/tamperward.git
cd tamperward
git switch main && git pull --ff-only
cd harness/taskbench/round4

docker compose -f docker/docker-compose.yml up --build mine
```

That runs in the **foreground** — deliberately. There is nothing to detach from
and nothing to reap it; Ctrl-C stops it and rerunning resumes from the ledger.
Leave it in its own terminal tab, or run it under `tmux`/`screen`.

To check on it, **`exec` into the running container** from another terminal:

```bash
docker compose -f docker/docker-compose.yml exec mine ./status.sh pilot
```

`exec`, not `run`. A `run` starts a *new* container with its own PID namespace:
it would share the volume's files but see none of the miner's processes, and
report `mining sessions 0` and `killed outright` while mining was perfectly
healthy. That false alarm is why the separate `status` service was removed.

After the run, the container is the supervisor, so ask it:

```bash
docker compose -f docker/docker-compose.yml ps -a      # exit status
docker compose -f docker/docker-compose.yml logs mine  # complete output
```

Those replace `launch-mine.sh`'s status and log files, which the foreground
container deliberately does not write — `status.sh` says so rather than
reporting their absence as a death.

The repository is bind-mounted, so the ledger and tasks land in your working
tree and are yours to commit. Clones and virtualenvs go to a named volume, off
the host filesystem. `docker volume rm round4_tb-work` clears them.

**The image is pinned, and that matters for the science.** `platform:
linux/amd64`, uv 0.8.17, Debian bookworm's Python 3.11, node 22 — matching the
environment the 12 already-decided repositories were mined on. On an Apple
Silicon Mac Docker would otherwise default to arm64, where a package with no
arm64 wheel fails to install and its repository is rejected: the same walk would
produce different verdicts. Every pilot and counted repository must be decided
on one architecture, so amd64 runs under emulation on Apple Silicon and is
slower. That is the intended trade.

## Native macOS (if you would rather not use Docker)

### One-time setup

```bash
# GNU tools the miner needs: flock, setsid, timeout
brew install util-linux coreutils git node python@3.12 uv

# util-linux and coreutils are keg-only — put them ahead of the BSD versions
echo 'export PATH="/opt/homebrew/opt/util-linux/bin:/opt/homebrew/opt/util-linux/sbin:/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"' >> ~/.zshrc
exec zsh -l

# verify — all three must resolve under /opt/homebrew
command -v flock setsid timeout
```

On an Intel Mac use `/usr/local/opt/...` instead of `/opt/homebrew/opt/...`.

### Get the repository

```bash
git clone https://github.com/hamsasoftware/tamperward.git
cd tamperward
git switch main && git pull --ff-only
npm ci
cd harness/taskbench/round4
```

Native mode runs on the host architecture and whatever `uv` is installed. If
that is not amd64 with uv 0.8.17, the decisions are not comparable with the ones
already in the ledger — which is the argument for Docker.

### Run the pilot

```bash
./launch-mine.sh pilot          # detached, sequential — the only pilot mode
./status.sh pilot               # check any time
```

`launch-mine.sh` refuses to start a second miner, and `mine5.sh` holds an
exclusive lock on the pool for its whole lifetime, so a stray second launch
exits 7 rather than corrupting the ledger.

Expect **roughly 140 repositories** for the pilot's 10 validated tasks, at round
3's measured yield of 14.0 repositories per task. Each repository is a shallow
clone, a virtualenv, and up to 8 candidate commits each running the suite under
a 300 s timeout, so a few minutes per repository is normal and a large
repository can be silent for much longer. Sequential is a protocol rule, not a
performance choice: every repository the pilot touches is burnt.

## Reading `status.sh`

| line | what it means |
| --- | --- |
| `mining sessions` | **1 is healthy.** 0 with an exit status = finished; 0 without = it was killed. More than 1 is accumulation — stop everything. |
| `processes` | parent plus subshells. Never a miner count; it is printed only so the two are not confused. |
| `heartbeat` | seconds since the last repository started. Distinguishes *working slowly* from *dead*, which the log alone cannot. |
| `CLONE_FAILED` | must stay **0**. Non-zero is the D3 regression. |
| `breaker` | `clear`. If it trips, the clone path failed and the miner stopped itself before writing a terminal verdict. |
| `exit status` | `signal:TERM` etc. if trapped; "killed outright" if the process vanished. |

## Stopping

Under Docker: Ctrl-C, or `docker compose -f docker/docker-compose.yml down`.

Natively, stop the **session**, not just the script — a descendant can outlive
the script. The pool lock itself is safe either way: it is held by a `flock
--close` guardian that never passes the descriptor to the miner or its children,
so it is released when the miner exits however it exits.

```bash
sid=$(cat /tmp/tb-mine-pilot.pid)
pkill -TERM -g "$sid"; sleep 5; pkill -KILL -g "$sid"
./status.sh pilot               # expect: mining sessions 0
```

(`-g` is the process group; on Linux `pkill -s` for the session works too.)

## When it finishes

`status.sh` shows `tasks 10` and an exit status of 0. Then:

```bash
python3 incident-D3/build-burn-list.py     # republish the cumulative burn set
git add -A . && git commit && git push     # the ledger, tasks and burn set
```

(Under Docker, `docker compose -f docker/docker-compose.yml exec mine python3
incident-D3/build-burn-list.py` while it is still up, or run it on the host —
it only reads committed files.)

Push the branch and I will take it from there — the freeze checklist against
v2.10.1, then the FRAME5-AMENDMENT-2 mapping, then freeze 2.

## Counted mining, later

Only after the pilot and the amendment-2 mapping. The counted pool is not
sacrificial and parallelises:

```bash
# Docker: same image, counted pool, four workers
docker compose -f docker/docker-compose.yml run --rm \
  -e TB_POOL=counted mine ./mine-parallel.sh 4

# native
./launch-mine.sh counted 4
./merge-shards.sh counted 4 110            # first 110 validated tasks in walk order
```

`run` is correct here (a one-off command, not something to monitor by PID), and
every runtime path in the counted scripts now derives from `TB_RUNTIME_DIR`, so
the shard locks, logs and staging directory land in the shared volume rather
than a container-local `/tmp`.

Four workers is the measured-clean concurrency for cloning; on a quad-core Mac
it is also about the point where the suite runs stop scaling.
