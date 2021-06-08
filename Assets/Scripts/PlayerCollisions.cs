using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class PlayerCollisions : MonoBehaviour
{
    public PlayerControls playerMvt;
    public HomingMissile missileMvt, missile1Mvt, missile2Mvt, missile3Mvt, missile4Mvt, missile5Mvt, missile6Mvt;
    public StayBoundedMissile boundsOfMissile, boundsOfMissile1, boundsOfMissile2, boundsOfMissile3, boundsOfMissile4, boundsOfMissile5, boundsOfMissile6;
    public Timer timer;
    public PauseMenu pauseMenu;
    public GameObject gameOverAnim;

    void OnCollisionEnter2D(Collision2D colinfo)
    {
        if (colinfo.collider.tag == "Missile")
        {
            Time.timeScale = 1f;

            playerMvt.enabled = false;

            missileMvt.enabled = false;
            missile1Mvt.enabled = false;
            missile2Mvt.enabled = false;
            missile3Mvt.enabled = false;
            missile4Mvt.enabled = false;
            missile5Mvt.enabled = false;
            missile6Mvt.enabled = false;

            boundsOfMissile.enabled = false;
            boundsOfMissile1.enabled = false;
            boundsOfMissile2.enabled = false;
            boundsOfMissile3.enabled = false;
            boundsOfMissile4.enabled = false;
            boundsOfMissile5.enabled = false;
            boundsOfMissile6.enabled = false;

            timer.enabled = false;
            pauseMenu.enabled = false;
            gameOverAnim.SetActive(true);

            Invoke("RestartLvl", 3.10f);

            FindObjectOfType<AudioManager>().Play("Gotcha");
        }
    }

    void RestartLvl()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}