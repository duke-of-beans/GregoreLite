// AEGIS Profile Timer — Sprint 16.0
// Ported from profiles/timer.ts.
// Tracks timed profile switches with expiry detection.

use super::types::TimerState;

pub struct ProfileTimer {
    state: TimerState,
}

impl ProfileTimer {
    pub fn new() -> Self {
        Self {
            state: TimerState::default(),
        }
    }

    pub fn is_active(&self) -> bool {
        self.state.active
    }

    /// Start a timed profile switch.
    pub fn start(
        &mut self,
        target_profile: String,
        return_profile: String,
        duration_min: f64,
    ) {
        let now = chrono::Utc::now();
        let expires = now + chrono::Duration::milliseconds((duration_min * 60_000.0) as i64);

        self.state = TimerState {
            active: true,
            target_profile: Some(target_profile),
            return_profile: Some(return_profile),
            started_at: Some(now.to_rfc3339()),
            duration_min: Some(duration_min),
            expires_at: Some(expires.to_rfc3339()),
        };
    }

    pub fn cancel(&mut self) {
        self.state = TimerState::default();
    }

    /// Check if the timer has expired. Returns the return_profile if expired.
    pub fn check_expiry(&mut self) -> Option<String> {
        if !self.state.active {
            return None;
        }

        let expires_at = match &self.state.expires_at {
            Some(s) => s.clone(),
            None => return None,
        };

        let expires = match chrono::DateTime::parse_from_rfc3339(&expires_at) {
            Ok(dt) => dt,
            Err(_) => return None,
        };

        if chrono::Utc::now() >= expires {
            let return_profile = self.state.return_profile.clone();
            self.cancel();
            return_profile
        } else {
            None
        }
    }

    pub fn to_state(&self) -> TimerState {
        self.state.clone()
    }

    pub fn from_state(&mut self, state: TimerState) {
        self.state = state;
    }
}
