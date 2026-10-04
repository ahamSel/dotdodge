using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class ButtonsScript : MonoBehaviour
{
    public void RestartLvl()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    public void LoadLvlMenu()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene("LvlMenu");
    }

    public void BackToStart()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene("Start");
    }

    public void ExitGame()
    {
        Application.Quit();
        Debug.Log("Later!");
    }



    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        if (Input.GetKeyDown("r"))
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }
    }
}
